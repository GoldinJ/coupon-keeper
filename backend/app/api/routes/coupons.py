import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import col, func, select

from app.api.deps import SessionDep, get_current_user
from app.core.config import settings
from app.models import (
    Coupon,
    CouponCreate,
    CouponPublic,
    CouponsPublic,
    CouponUpdate,
    Brand,
    Message,
    User,
)

router = APIRouter(prefix="/coupons", tags=["coupons"])


def _allow_local_coupon_auth_bypass() -> bool:
    return settings.ENVIRONMENT == "local" and settings.ENABLE_LOCAL_COUPON_AUTH_BYPASS


def _allow_local_default_brand() -> bool:
    return settings.ENVIRONMENT == "local" and settings.ENABLE_LOCAL_DEFAULT_ISSUER


def _require_coupon_user(current_user: User | None) -> User:
    if current_user:
        return current_user
    if _allow_local_coupon_auth_bypass():
        return User(
            email="local-dev@example.com",
            hashed_password="local-dev-only",
            is_active=True,
            is_superuser=True,
        )
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
            if modified:
                session.add(brand)
                session.commit()
                session.refresh(brand)
            return brand.id
        else:
            new_brand = Brand(name=brand_name, logo_url=brand_logo_url, color=brand_color)
            session.add(new_brand)
            session.commit()
            session.refresh(new_brand)
            return new_brand.id

    if not _allow_local_default_brand():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="brand_id or brand_name is required",
        )

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
    coupon_payload = coupon_in.model_dump(exclude={"brand_name", "brand_logo_url", "brand_color"})
    coupon_payload["brand_id"] = _resolve_brand_id(
        session,
        coupon_in.brand_id,
        brand_name=coupon_in.brand_name,
        brand_logo_url=coupon_in.brand_logo_url,
        brand_color=coupon_in.brand_color,
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
    if not current_user.is_superuser and not _allow_local_coupon_auth_bypass():
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_dict = coupon_in.model_dump(exclude_unset=True, exclude={"brand_name", "brand_logo_url", "brand_color"})
    if coupon_in.brand_name:
        update_dict["brand_id"] = _resolve_brand_id(
            session,
            coupon_in.brand_id,
            brand_name=coupon_in.brand_name,
            brand_logo_url=coupon_in.brand_logo_url,
            brand_color=coupon_in.brand_color,
        )
    elif update_dict.get("brand_id") is None and "brand_id" in update_dict:
        update_dict["brand_id"] = _resolve_brand_id(session, None)

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
    if not current_user.is_superuser and not _allow_local_coupon_auth_bypass():
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(coupon)
    session.commit()
    return Message(message="Coupon deleted successfully")
