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
    Issuer,
    Message,
    User,
)

router = APIRouter(prefix="/coupons", tags=["coupons"])


def _allow_local_coupon_auth_bypass() -> bool:
    return settings.ENVIRONMENT == "local" and settings.ENABLE_LOCAL_COUPON_AUTH_BYPASS


def _allow_local_default_issuer() -> bool:
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


def _resolve_issuer_id(session: SessionDep, issuer_id: uuid.UUID | None) -> uuid.UUID:
    if issuer_id is not None:
        return issuer_id
    if not _allow_local_default_issuer():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="issuer_id is required",
        )

    default_issuer = session.exec(
        select(Issuer).where(Issuer.name == "Local Default Issuer")
    ).first()
    if default_issuer is None:
        default_issuer = Issuer(name="Local Default Issuer")
        session.add(default_issuer)
        session.commit()
        session.refresh(default_issuer)

    return default_issuer.id


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
    coupon_payload = coupon_in.model_dump()
    coupon_payload["issuer_id"] = _resolve_issuer_id(session, coupon_in.issuer_id)
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

    update_dict = coupon_in.model_dump(exclude_unset=True)
    if update_dict.get("issuer_id") is None and "issuer_id" in update_dict:
        update_dict["issuer_id"] = _resolve_issuer_id(session, None)

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
