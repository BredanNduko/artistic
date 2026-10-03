from __future__ import annotations

import random

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import current_user, current_user_optional
from ..models import User, iso
from ..ratelimit import auth_limiter, client_key
from ..security import create_session_token, hash_password, new_id, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

AVATAR_COLORS = ["#4f46e5", "#0ea5e9", "#16a34a", "#f59e0b", "#db2777", "#7c3aed"]


def user_out(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "avatarColor": u.avatar_color,
        "plan": u.plan,
        "createdAt": iso(u.created_at),
        "teamId": u.team_id,
    }


class SignUpIn(BaseModel):
    email: EmailStr
    name: str | None = Field(None, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class SignInIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProfilePatch(BaseModel):
    # Unknown keys (plan, email, id...) are ignored: no mass-assignment.
    model_config = ConfigDict(extra="ignore")
    name: str | None = Field(None, min_length=1, max_length=120)
    avatarColor: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


def _set_session(response: Response, user: User) -> None:
    s = get_settings()
    response.set_cookie(
        s.cookie_name,
        create_session_token(user.id),
        max_age=s.session_days * 86400,
        httponly=True,
        secure=s.cookie_secure,
        samesite=s.cookie_samesite,
        path="/",
    )


@router.get("/me")
def me(user: User | None = Depends(current_user_optional)):
    return user_out(user) if user else None


@router.post("/sign-up")
def sign_up(body: SignUpIn, request: Request, response: Response, db: Session = Depends(get_db)):
    auth_limiter.check(f"up:{client_key(request)}")
    email = body.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists.")
    user = User(
        id=new_id("usr"),
        email=email,
        name=(body.name or "").strip() or email.split("@")[0],
        password_hash=hash_password(body.password),
        avatar_color=random.choice(AVATAR_COLORS),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # lost a race with another sign-up
        db.rollback()
        raise HTTPException(409, "An account with this email already exists.")
    _set_session(response, user)
    return user_out(user)


@router.post("/sign-in")
def sign_in(body: SignInIn, request: Request, response: Response, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    auth_limiter.check(f"in:{client_key(request)}:{email}")
    user = db.scalar(select(User).where(User.email == email))
    if not verify_password(body.password, user.password_hash if user else None):
        raise HTTPException(401, "Invalid email or password.")
    _set_session(response, user)
    return user_out(user)


@router.post("/sign-out", status_code=204)
def sign_out(response: Response):
    s = get_settings()
    response.delete_cookie(s.cookie_name, path="/", secure=s.cookie_secure, samesite=s.cookie_samesite)
    response.status_code = 204
    return response


@router.patch("/me")
def update_me(body: ProfilePatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.name is not None:
        user.name = body.name.strip()
    if body.avatarColor is not None:
        user.avatar_color = body.avatarColor
    db.add(user)
    db.commit()
    return user_out(user)
