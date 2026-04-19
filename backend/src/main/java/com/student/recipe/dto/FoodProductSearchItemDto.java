package com.student.recipe.dto;

public record FoodProductSearchItemDto(
        long id,
        long fdcId,
        String name,
        Double defaultGramWeight,
        Double pieceGramWeight,
        Double caloriesPer100g,
        Double proteinPer100g,
        Double carbsPer100g,
        Double fatPer100g
) {
}
