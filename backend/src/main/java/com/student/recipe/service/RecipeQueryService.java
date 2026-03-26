package com.student.recipe.service;

import java.util.Comparator;
import java.util.List;

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

    private final RecipeRepository recipeRepository;

    public RecipeQueryService(RecipeRepository recipeRepository) {
        this.recipeRepository = recipeRepository;
    }

    @Transactional(readOnly = true)
    public List<RecipeListItemDto> listRecipes() {
        return recipeRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(recipe -> new RecipeListItemDto(
                        recipe.getId(),
                        recipe.getTitle(),
                        recipe.getImage(),
                        recipe.getServings(),
                        recipe.getReadyInMinutes(),
                        recipe.getRecipeNutrition() != null ? recipe.getRecipeNutrition().getCalories() : null
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
}
