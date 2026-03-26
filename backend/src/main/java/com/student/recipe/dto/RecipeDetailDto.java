package com.student.recipe.dto;

import java.util.List;

public record RecipeDetailDto(
        Long id,
        Long spoonacularId,
        String title,
        String image,
        String summary,
        String instructions,
        Integer servings,
        Integer readyInMinutes,
        String sourceUrl,
        String spoonacularSourceUrl,
        Double healthScore,
        Double pricePerServing,
        Boolean vegetarian,
        Boolean vegan,
        Boolean glutenFree,
        Boolean dairyFree,
        Boolean veryHealthy,
        Boolean cheap,
        Boolean veryPopular,
        Boolean sustainable,
        Boolean lowFodmap,
        RecipeNutritionDto nutrition,
        List<RecipeIngredientDto> ingredients,
        List<RecipeStepDto> steps,
        List<RecipeTagDto> tags
) {
}
