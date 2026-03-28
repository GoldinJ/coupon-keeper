import uuid
from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import SessionDep, get_current_user
from app.api.services.coupon_service import CouponService
from app.models import (
    CouponCreate,
    CouponPublic,
    CouponsPublic,
    CouponUpdate,
    Message,
    User,
)

router = APIRouter(prefix="/coupons", tags=["coupons"])


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
    service = CouponService(session)
    return service.list_coupons(current_user=current_user, skip=skip, limit=limit)


@router.get("/{id}", response_model=CouponPublic)
def read_coupon(
    session: SessionDep,
    id: uuid.UUID,
    current_user: User | None = Depends(get_current_user),
) -> Any:
    """
    Get coupon by ID.
    """
    service = CouponService(session)
    return service.get_coupon(coupon_id=id, current_user=current_user)


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
    service = CouponService(session)
    return service.create_coupon(coupon_in=coupon_in, current_user=current_user)


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
    service = CouponService(session)
    return service.update_coupon(
        coupon_id=id,
        coupon_in=coupon_in,
        current_user=current_user,
    )


@router.delete("/{id}")
def delete_coupon(
    session: SessionDep,
    id: uuid.UUID,
    current_user: User | None = Depends(get_current_user),
) -> Message:
    """
    Delete a coupon.
    """
    service = CouponService(session)
    return service.delete_coupon(coupon_id=id, current_user=current_user)
