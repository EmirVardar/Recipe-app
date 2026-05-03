package com.student.recipe.dto.fridge;

public record FridgeItemResponseDto(
        Long id,
        Long foodProductId,
        String foodName,
        Double quantity,
        String unitType,
        Double gramEquivalent,
        Double calories,
        Double protein,
        Double carbs,
        Double fat,
        Double defaultGramWeight,
        Double pieceGramWeight
) {
}
