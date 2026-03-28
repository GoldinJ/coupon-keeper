import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import col, func, select

from app.api.deps import SessionDep, get_current_user
from app.core.config import settings
from app.models import (
    Brand,
    Coupon,
    CouponType,
    CouponCreate,
    CouponPublic,
    CouponsPublic,
    CouponUpdate,
    Message,
    User,
)

router = APIRouter(prefix="/coupons", tags=["coupons"])


def _require_coupon_user(current_user: User | None) -> User:
    if current_user:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


def _resolve_brand_id(
    session: SessionDep,
    brand_id: uuid.UUID | None,
    brand_name: str | None = None,
    brand_logo_url: str | None = None,
    brand_color: str | None = None,
    brand_website: str | None = None,
) -> uuid.UUID:
    if brand_id is not None:
        return brand_id

    if brand_name:
        brand = session.exec(
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
                session.add(brand)
                session.commit()
                session.refresh(brand)
            return brand.id
        else:
            new_brand = Brand(
                name=brand_name,
                logo_url=brand_logo_url,
                color=brand_color,
                website=brand_website,
            )
            session.add(new_brand)
            session.commit()
            session.refresh(new_brand)
            return new_brand.id

    default_brand = session.exec(
        select(Brand).where(Brand.name == "Local Default Brand")
    ).first()
    if default_brand is None:
        default_brand = Brand(name="Local Default Brand")
        session.add(default_brand)
        session.commit()
        session.refresh(default_brand)

    return default_brand.id


@router.get("/", response_model=CouponsPublic)
def read_coupons(
    session: SessionDep,
    current_user: User | None = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve coupons.
    """
    current_user = _require_coupon_user(current_user)
    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Coupon)
        count = session.exec(count_statement).one()
        statement = (
            select(Coupon)
            .order_by(col(Coupon.created_at).desc())
            .offset(skip)
            .limit(limit)
        )
    else:
        count_statement = select(func.count()).select_from(Coupon)
        count = session.exec(count_statement).one()
        statement = (
            select(Coupon)
            .order_by(col(Coupon.created_at).desc())
            .offset(skip)
            .limit(limit)
        )

    coupons = session.exec(statement).all()
    return CouponsPublic(data=coupons, count=count)


@router.get("/{id}", response_model=CouponPublic)
def read_coupon(
    session: SessionDep,
    id: uuid.UUID,
    current_user: User | None = Depends(get_current_user),
) -> Any:
    """
    Get coupon by ID.
    """
    _require_coupon_user(current_user)
    coupon = session.get(Coupon, id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return coupon


@router.post("/", response_model=CouponPublic)
def create_coupon(
    *,
    session: SessionDep,
    coupon_in: CouponCreate,
    current_user: User | None = Depends(get_current_user),
) -> Any:
    """
    Create new coupon.
    """
    _require_coupon_user(current_user)
    coupon_payload = coupon_in.model_dump(
        exclude={"brand_name", "brand_logo_url", "brand_color", "brand_website"}
    )
    coupon_payload["brand_id"] = _resolve_brand_id(
        session,
        coupon_in.brand_id,
        brand_name=coupon_in.brand_name,
        brand_logo_url=coupon_in.brand_logo_url,
        brand_color=coupon_in.brand_color,
        brand_website=coupon_in.brand_website,
    )
    coupon = Coupon.model_validate(coupon_payload)
    session.add(coupon)
    session.commit()
    session.refresh(coupon)
    return coupon


@router.patch("/{id}", response_model=CouponPublic)
@router.put("/{id}", response_model=CouponPublic)
def update_coupon(
    *,
    session: SessionDep,
    id: uuid.UUID,
    coupon_in: CouponUpdate,
    current_user: User | None = Depends(get_current_user),
) -> Any:
    """
    Update a coupon.
    """
    current_user = _require_coupon_user(current_user)
    coupon = session.get(Coupon, id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    update_dict = coupon_in.model_dump(
        exclude_unset=True,
        exclude={"brand_name", "brand_logo_url", "brand_color", "brand_website"},
    )
    if coupon_in.brand_name:
        update_dict["brand_id"] = _resolve_brand_id(
            session,
            coupon_in.brand_id,
            brand_name=coupon_in.brand_name,
            brand_logo_url=coupon_in.brand_logo_url,
            brand_color=coupon_in.brand_color,
            brand_website=coupon_in.brand_website,
        )
    elif update_dict.get("brand_id") is None and "brand_id" in update_dict:
        update_dict["brand_id"] = _resolve_brand_id(session, None)

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
    session.add(coupon)
    session.commit()
    session.refresh(coupon)
    return coupon


@router.delete("/{id}")
def delete_coupon(
    session: SessionDep,
    id: uuid.UUID,
    current_user: User | None = Depends(get_current_user),
) -> Message:
    """
    Delete a coupon.
    """
    current_user = _require_coupon_user(current_user)
    coupon = session.get(Coupon, id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    session.delete(coupon)
    session.commit()
    return Message(message="Coupon deleted successfully")
