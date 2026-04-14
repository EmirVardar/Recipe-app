package com.student.recipe.dto;

public record FnddsRawImportResponseDto(
        int foodRows,
        int foodNutrientRows,
        int nutrientRows,
        int foodPortionRows,
        int measureUnitRows,
        int surveyFoodRows,
        String message
) {
}
