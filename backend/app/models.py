import uuid
from datetime import datetime, timezone

from pydantic import EmailStr
from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: uuid.UUID | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)

class BrandBase(SQLModel):
    id : uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    color: str | None = Field(default=None, max_length=50)

class Brand(BrandBase, table=True):
    name: str = Field(min_length=1, max_length=255)
    logo_url: str | None = Field(default=None, max_length=255)
    website: str | None = Field(default=None, max_length=255)
    coupons: list["Coupon"] = Relationship(back_populates="brand")

class BrandPublic(BrandBase):
    name: str
    logo_url: str | None = None
    website: str | None = None

class BrandsPublic(SQLModel):
    data: list[BrandPublic]
    count: int

class CouponBase(SQLModel):
    id : uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )

class Coupon(CouponBase, table=True):
    title: str = Field(min_length=1, max_length=255)
    source: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    expiry_date: datetime
    is_used: bool = False
    code: str = Field(min_length=1, max_length=255)
    brand_id: uuid.UUID = Field(foreign_key="brand.id", nullable=False)
    brand: Brand = Relationship(
        back_populates="coupons", sa_relationship_kwargs={"lazy": "selectin"}
    )


# Properties to receive on coupon creation
class CouponCreate(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    source: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    expiry_date: datetime
    code: str = Field(min_length=1, max_length=255)
    brand_id: uuid.UUID | None = None
    brand_name: str | None = None
    brand_logo_url: str | None = None
    brand_color: str | None = None


# Properties to receive on coupon update, all are optional
class CouponUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    source: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    expiry_date: datetime | None = None
    is_used: bool | None = None
    code: str | None = Field(default=None, min_length=1, max_length=255)
    brand_id: uuid.UUID | None = None
    brand_name: str | None = None
    brand_logo_url: str | None = None
    brand_color: str | None = None


# Properties to return via API
class CouponPublic(SQLModel):
    id: uuid.UUID
    created_at: datetime | None = None
    title: str
    source: str
    description: str | None = None
    expiry_date: datetime
    is_used: bool
    code: str
    brand_id: uuid.UUID | None = None
    brand: BrandPublic | None = None


class CouponsPublic(SQLModel):
    data: list[CouponPublic]
    count: int
