from fastapi import APIRouter, Depends

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.offers import service
from app.offers.schemas import (
    CreateOfferRequest,
    Offer,
    OfferList,
    UpdateOfferRequest,
)

router = APIRouter()


@router.post("/")
def create_offer(
    payload: CreateOfferRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.create_offer(db, payload, current_user_id)
    return success(data=Offer(**result).model_dump())


@router.get("/")
def list_offers(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    result = service.list_offers(db, current_user_id)
    return success(data=OfferList(**result).model_dump())


@router.put("/{id}")
def update_offer(
    id: str,
    payload: UpdateOfferRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.update_offer(db, id, current_user_id, payload)
    return success(data=Offer(**result).model_dump())


@router.delete("/{id}")
def delete_offer(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    service.delete_offer(db, id, current_user_id)
    return success(data=None)
