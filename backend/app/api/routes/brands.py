import uuid
from typing import Any

from fastapi import APIRouter, Depends
from sqlmodel import func, select

from app.api.deps import SessionDep, get_current_user
from app.models import Brand, BrandsPublic, User

router = APIRouter(prefix="/brands", tags=["brands"])

@router.get("/", response_model=BrandsPublic)
def read_brands(
    session: SessionDep,
    current_user: User | None = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve brands.
    """
    count_statement = select(func.count()).select_from(Brand)
    count = session.exec(count_statement).one()
    statement = select(Brand).offset(skip).limit(limit)
    brands = session.exec(statement).all()
    return BrandsPublic(data=brands, count=count)
