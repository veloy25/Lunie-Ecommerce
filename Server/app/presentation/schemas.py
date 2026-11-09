from __future__ import annotations

import re
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class DimensionsInput(BaseModel):
    width_cm: float = Field(gt=0, le=200)
    height_cm: float = Field(gt=0, le=200)
    length_cm: float = Field(gt=0, le=200)


class ProductPatch(BaseModel):
    price_cents: int | None = Field(default=None, ge=1, le=100_000_000)
    stock: int | None = Field(default=None, ge=0, le=10_000_000)
    weight_grams: int | None = Field(default=None, ge=1, le=100_000_000)
    dimensions: DimensionsInput | None = None
    description: Annotated[str | None, Field(default=None, max_length=4000)] = None
    is_active: bool | None = None

class CartItemInput(BaseModel):
    product_id: str = Field(min_length=1, max_length=180)
    quantity: int = Field(ge=1, le=99)


class AddressInput(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: str = Field(min_length=5, max_length=320)
    phone: str
    document: str
    postal_code: str
    street: str = Field(min_length=2, max_length=220)
    number: str = Field(min_length=1, max_length=30)
    complement: str | None = Field(default=None, max_length=120)
    district: str = Field(min_length=2, max_length=120)
    city: str = Field(min_length=2, max_length=120)
    state: str = Field(min_length=2, max_length=2)

    @field_validator("postal_code")
    @classmethod
    def normalize_postal_code(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)
        if len(digits) != 8:
            raise ValueError("Informe um CEP válido com 8 dígitos.")
        return digits

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Informe um e-mail válido.")
        return normalized

    @field_validator("state")
    @classmethod
    def normalize_state(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not re.fullmatch(r"[A-Z]{2}", normalized):
            raise ValueError("Informe a sigla do estado com 2 letras.")
        return normalized

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)
        if not 10 <= len(digits) <= 13:
            raise ValueError("Informe um telefone válido com DDD.")
        return digits

    @field_validator("document")
    @classmethod
    def normalize_cpf(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)
        if len(digits) != 11 or len(set(digits)) == 1:
            raise ValueError("Informe um CPF válido.")
        numbers = [int(char) for char in digits]
        for position in (9, 10):
            total = sum(numbers[index] * (position + 1 - index) for index in range(position))
            check = (total * 10) % 11
            if check == 10:
                check = 0
            if numbers[position] != check:
                raise ValueError("Informe um CPF válido.")
        return digits


class ShippingQuoteInput(BaseModel):
    items: list[CartItemInput] = Field(min_length=1, max_length=25)
    to_postal_code: str

    @field_validator("to_postal_code")
    @classmethod
    def normalize_postal_code(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)
        if len(digits) != 8:
            raise ValueError("Informe um CEP válido com 8 dígitos.")
        return digits


class CheckoutInput(BaseModel):
    items: list[CartItemInput] = Field(min_length=1, max_length=25)
    email: str = Field(min_length=5, max_length=320)
    address: AddressInput
    shipping_quote_id: str = Field(min_length=36, max_length=36)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Informe um e-mail válido.")
        return normalized

    @model_validator(mode="after")
    def address_email_matches_checkout(self) -> CheckoutInput:
        if self.address.email != self.email:
            raise ValueError("O e-mail do endereço deve ser igual ao e-mail do pedido.")
        return self


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str | None
    role: str

