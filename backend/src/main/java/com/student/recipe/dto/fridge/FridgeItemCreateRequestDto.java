package com.student.recipe.dto.fridge;

public record FridgeItemCreateRequestDto(
        Long foodProductId,
        Double quantity,
        String unitType
) {
}
