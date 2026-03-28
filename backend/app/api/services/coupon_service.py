import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlmodel import Session, col, func, select

from app.models import (
	Brand,
	Coupon,
	CouponCreate,
	CouponsPublic,
	CouponType,
	CouponUpdate,
	Message,
	User,
)


class CouponService:
	def __init__(self, session: Session) -> None:
		self.session = session

	def require_coupon_user(self, current_user: User | None) -> User:
		if current_user:
			return current_user
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Not authenticated",
		)

	def resolve_brand_id(
		self,
		brand_id: uuid.UUID | None,
		brand_name: str | None = None,
		brand_logo_url: str | None = None,
		brand_color: str | None = None,
		brand_website: str | None = None,
	) -> uuid.UUID:
		if brand_id is not None:
			return brand_id

		if brand_name:
			brand = self.session.exec(
				select(Brand).where(Brand.name == brand_name)
			).first()
			if brand:
				modified = False
				if brand_logo_url and brand.logo_url != brand_logo_url:
					brand.logo_url = brand_logo_url
					modified = True
				if brand_color and brand.color != brand_color:
					brand.color = brand_color
					modified = True
				if brand_website and brand.website != brand_website:
					brand.website = brand_website
					modified = True
				if modified:
					self.session.add(brand)
					self.session.commit()
					self.session.refresh(brand)
				return brand.id

			new_brand = Brand(
				name=brand_name,
				logo_url=brand_logo_url,
				color=brand_color,
				website=brand_website,
			)
			self.session.add(new_brand)
			self.session.commit()
			self.session.refresh(new_brand)
			return new_brand.id

		default_brand = self.session.exec(
			select(Brand).where(Brand.name == "Local Default Brand")
		).first()
		if default_brand is None:
			default_brand = Brand(name="Local Default Brand")
			self.session.add(default_brand)
			self.session.commit()
			self.session.refresh(default_brand)

		return default_brand.id

	def list_coupons(
		self,
		current_user: User | None,
		skip: int = 0,
		limit: int = 100,
	) -> CouponsPublic:
		current_user = self.require_coupon_user(current_user)
		if current_user.is_superuser:
			count_statement = select(func.count()).select_from(Coupon)
			count = self.session.exec(count_statement).one()
			statement = (
				select(Coupon)
				.order_by(col(Coupon.created_at).desc())
				.offset(skip)
				.limit(limit)
			)
		else:
			count_statement = select(func.count()).select_from(Coupon)
			count = self.session.exec(count_statement).one()
			statement = (
				select(Coupon)
				.order_by(col(Coupon.created_at).desc())
				.offset(skip)
				.limit(limit)
			)

		coupons = self.session.exec(statement).all()
		return CouponsPublic(data=coupons, count=count)

	def get_coupon(
		self,
		coupon_id: uuid.UUID,
		current_user: User | None,
	) -> Coupon:
		self.require_coupon_user(current_user)
		coupon = self.session.get(Coupon, coupon_id)
		if not coupon:
			raise HTTPException(status_code=404, detail="Coupon not found")
		return coupon

	def create_coupon(
		self,
		coupon_in: CouponCreate,
		current_user: User | None,
	) -> Coupon:
		self.require_coupon_user(current_user)
		coupon_payload: dict[str, Any] = coupon_in.model_dump(
			exclude={"brand_name", "brand_logo_url", "brand_color", "brand_website"}
		)
		coupon_payload["brand_id"] = self.resolve_brand_id(
			coupon_in.brand_id,
			brand_name=coupon_in.brand_name,
			brand_logo_url=coupon_in.brand_logo_url,
			brand_color=coupon_in.brand_color,
			brand_website=coupon_in.brand_website,
		)
		coupon = Coupon.model_validate(coupon_payload)
		self.session.add(coupon)
		self.session.commit()
		self.session.refresh(coupon)
		return coupon

	def update_coupon(
		self,
		coupon_id: uuid.UUID,
		coupon_in: CouponUpdate,
		current_user: User | None,
	) -> Coupon:
		current_user = self.require_coupon_user(current_user)
		coupon = self.session.get(Coupon, coupon_id)
		if not coupon:
			raise HTTPException(status_code=404, detail="Coupon not found")

		update_dict = coupon_in.model_dump(
			exclude_unset=True,
			exclude={"brand_name", "brand_logo_url", "brand_color", "brand_website"},
		)
		if coupon_in.brand_name:
			update_dict["brand_id"] = self.resolve_brand_id(
				coupon_in.brand_id,
				brand_name=coupon_in.brand_name,
				brand_logo_url=coupon_in.brand_logo_url,
				brand_color=coupon_in.brand_color,
				brand_website=coupon_in.brand_website,
			)
		elif update_dict.get("brand_id") is None and "brand_id" in update_dict:
			update_dict["brand_id"] = self.resolve_brand_id(None)

		effective_type = coupon_in.coupon_type or coupon.coupon_type
		if effective_type == CouponType.GIFT_CARD:
			if "current_value" in update_dict or "is_used" in update_dict:
				current_value = update_dict.get("current_value", coupon.current_value)
				is_used = update_dict.get("is_used", coupon.is_used)
				if current_value != 0 or not is_used:
					raise HTTPException(
						status_code=400,
						detail="Gift cards must be redeemed in full.",
					)

		coupon.sqlmodel_update(update_dict)
		self.session.add(coupon)
		self.session.commit()
		self.session.refresh(coupon)
		return coupon

	def delete_coupon(
		self,
		coupon_id: uuid.UUID,
		current_user: User | None,
	) -> Message:
		current_user = self.require_coupon_user(current_user)
		coupon = self.session.get(Coupon, coupon_id)
		if not coupon:
			raise HTTPException(status_code=404, detail="Coupon not found")
		coupon.is_used = True
		self.session.add(coupon)
		self.session.commit()
		return Message(message="Coupon deleted successfully")
