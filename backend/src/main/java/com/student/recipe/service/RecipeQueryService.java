package com.student.recipe.service;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.RecipeDetailDto;
import com.student.recipe.dto.RecipeIngredientDto;
import com.student.recipe.dto.RecipeListItemDto;
import com.student.recipe.dto.RecipeNutritionDto;
import com.student.recipe.dto.RecipeStepDto;
import com.student.recipe.dto.RecipeTagDto;
import com.student.recipe.entity.Recipe;
import com.student.recipe.entity.RecipeIngredient;
import com.student.recipe.entity.RecipeNutrition;
import com.student.recipe.entity.RecipeStep;
import com.student.recipe.entity.RecipeTag;
import com.student.recipe.repository.RecipeRepository;

@Service
public class RecipeQueryService {

    private static final double HIGH_PROTEIN_THRESHOLD_GRAMS = 20.0;

    private final RecipeRepository recipeRepository;
    private final RecipeFavoriteService recipeFavoriteService;

    public RecipeQueryService(RecipeRepository recipeRepository, RecipeFavoriteService recipeFavoriteService) {
        this.recipeRepository = recipeRepository;
        this.recipeFavoriteService = recipeFavoriteService;
    }

    @Transactional(readOnly = true)
    public List<RecipeListItemDto> listRecipes(
            String email,
            String query,
            Double minCalories,
            Double maxCalories,
            Boolean highProtein,
            Integer maxReadyInMinutes,
            Boolean vegetarian,
            Boolean vegan,
            String category
    ) {
        String normalizedQuery = query == null ? "" : query.trim();
        String normalizedCategory = category == null ? "" : category.trim().toLowerCase();
        Set<Long> favoriteRecipeIds = recipeFavoriteService.getFavoriteRecipeIds(email);

        List<Recipe> recipes = recipeRepository.searchRecipes(
                normalizedQuery,
                minCalories,
                maxCalories,
                Boolean.TRUE.equals(highProtein),
                HIGH_PROTEIN_THRESHOLD_GRAMS,
                maxReadyInMinutes,
                vegetarian,
                vegan,
                normalizedCategory
        );

        return recipes
                .stream()
                .map(recipe -> new RecipeListItemDto(
                        recipe.getId(),
                        recipe.getTitle(),
                        recipe.getImage(),
                        resolvePrimaryCategory(recipe),
                        recipe.getServings(),
                        recipe.getReadyInMinutes(),
                        recipe.getRecipeNutrition() != null ? recipe.getRecipeNutrition().getCalories() : null,
                        favoriteRecipeIds.contains(recipe.getId())
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RecipeListItemDto> listFavoriteRecipes(String email) {
        return recipeFavoriteService.getFavoriteRecipes(email)
                .stream()
                .map(recipe -> new RecipeListItemDto(
                        recipe.getId(),
                        recipe.getTitle(),
                        recipe.getImage(),
                        resolvePrimaryCategory(recipe),
                        recipe.getServings(),
                        recipe.getReadyInMinutes(),
                        recipe.getRecipeNutrition() != null ? recipe.getRecipeNutrition().getCalories() : null,
                        true
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public RecipeDetailDto getRecipeDetail(Long id) {
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipe not found"));

        return new RecipeDetailDto(
                recipe.getId(),
                recipe.getSpoonacularId(),
                recipe.getTitle(),
                recipe.getImage(),
                resolvePrimaryCategory(recipe),
                recipe.getSummary(),
                recipe.getInstructions(),
                recipe.getServings(),
                recipe.getReadyInMinutes(),
                recipe.getSourceUrl(),
                recipe.getSpoonacularSourceUrl(),
                recipe.getHealthScore(),
                recipe.getPricePerServing(),
                recipe.getVegetarian(),
                recipe.getVegan(),
                recipe.getGlutenFree(),
                recipe.getDairyFree(),
                recipe.getVeryHealthy(),
                recipe.getCheap(),
                recipe.getVeryPopular(),
                recipe.getSustainable(),
                recipe.getLowFodmap(),
                toNutritionDto(recipe.getRecipeNutrition()),
                recipe.getRecipeIngredients().stream()
                        .map(this::toIngredientDto)
                        .toList(),
                recipe.getRecipeSteps().stream()
                        .sorted(Comparator.comparing(RecipeStep::getStepNumber))
                        .map(step -> new RecipeStepDto(step.getStepNumber(), step.getInstruction()))
                        .toList(),
                recipe.getRecipeTags().stream()
                        .sorted(Comparator.comparing(RecipeTag::getTagType).thenComparing(RecipeTag::getTagValue))
                        .map(tag -> new RecipeTagDto(tag.getTagType(), tag.getTagValue()))
                        .toList()
        );
    }

    private RecipeIngredientDto toIngredientDto(RecipeIngredient recipeIngredient) {
        return new RecipeIngredientDto(
                recipeIngredient.getIngredient().getId(),
                recipeIngredient.getIngredient().getSpoonacularId(),
                recipeIngredient.getIngredient().getName(),
                recipeIngredient.getIngredient().getOriginalName(),
                recipeIngredient.getIngredient().getImage(),
                recipeIngredient.getAmount(),
                recipeIngredient.getUnit(),
                recipeIngredient.getConsistency(),
                recipeIngredient.getAisle(),
                recipeIngredient.getOriginalText()
        );
    }

    private RecipeNutritionDto toNutritionDto(RecipeNutrition nutrition) {
        if (nutrition == null) {
            return null;
        }

        return new RecipeNutritionDto(
                nutrition.getCalories(),
                nutrition.getProtein(),
                nutrition.getFat(),
                nutrition.getCarbs(),
                nutrition.getFiber(),
                nutrition.getSugar(),
                nutrition.getSodium()
        );
    }

    private String resolvePrimaryCategory(Recipe recipe) {
        List<String> dishTypes = recipe.getRecipeTags().stream()
                .filter(tag -> "dish_type".equals(tag.getTagType()))
                .map(RecipeTag::getTagValue)
                .toList();

        if (dishTypes.isEmpty()) {
            return "main";
        }

        if (containsCategory(dishTypes, "dessert")) {
            return "dessert";
        }
        if (containsCategory(dishTypes, "salad")) {
            return "salad";
        }
        if (containsCategory(dishTypes, "soup")) {
            return "soup";
        }
        if (containsCategory(dishTypes, "breakfast")) {
            return "breakfast";
        }
        if (containsCategory(dishTypes, "drink")) {
            return "drink";
        }
        if (containsCategory(dishTypes, "snack")) {
            return "snack";
        }
        if (containsCategory(dishTypes, "lunch")) {
            return "lunch";
        }
        if (containsCategory(dishTypes, "dinner")) {
            return "dinner";
        }

        return "main";
    }

    private boolean containsCategory(List<String> dishTypes, String expected) {
        return dishTypes.stream().anyMatch(value -> value != null && value.equalsIgnoreCase(expected));
    }
}
