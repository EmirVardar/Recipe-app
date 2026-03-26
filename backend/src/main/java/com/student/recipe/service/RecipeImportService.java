package com.student.recipe.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.SpoonacularImportResponseDto;
import com.student.recipe.entity.Ingredient;
import com.student.recipe.entity.Recipe;
import com.student.recipe.entity.RecipeIngredient;
import com.student.recipe.entity.RecipeNutrition;
import com.student.recipe.entity.RecipeStep;
import com.student.recipe.entity.RecipeTag;
import com.student.recipe.integration.spoonacular.SpoonacularClient.AnalyzedInstruction;
import com.student.recipe.integration.spoonacular.SpoonacularClient.InstructionStep;
import com.student.recipe.integration.spoonacular.SpoonacularClient.Nutrient;
import com.student.recipe.integration.spoonacular.SpoonacularClient.Nutrition;
import com.student.recipe.integration.spoonacular.SpoonacularClient;
import com.student.recipe.integration.spoonacular.SpoonacularClient.SpoonacularIngredient;
import com.student.recipe.integration.spoonacular.SpoonacularClient.SpoonacularRecipe;
import com.student.recipe.repository.IngredientRepository;
import com.student.recipe.repository.RecipeRepository;

@Service
public class RecipeImportService {

    private static final List<String> POPULAR_RECIPE_QUERIES = List.of(
            "pizza",
            "cheeseburger",
            
            "spaghetti",

            "meatballs",
            "lentil soup",
            "rice pilaf",
            "brownies",
            "cookies"
    );

    private final SpoonacularClient spoonacularClient;
    private final RecipeRepository recipeRepository;
    private final IngredientRepository ingredientRepository;
    private final String apiKey;
    private final int maxImportLimit;

    public RecipeImportService(
            SpoonacularClient spoonacularClient,
            RecipeRepository recipeRepository,
            IngredientRepository ingredientRepository,
            @Value("${spoonacular.api-key:}") String apiKey,
            @Value("${spoonacular.max-import-limit:10}") int maxImportLimit
    ) {
        this.spoonacularClient = spoonacularClient;
        this.recipeRepository = recipeRepository;
        this.ingredientRepository = ingredientRepository;
        this.apiKey = apiKey;
        this.maxImportLimit = maxImportLimit;
    }

    @Transactional
    public SpoonacularImportResponseDto importPopularRecipes(int requestedLimit) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Spoonacular API key is missing");
        }

        int limit = normalizeLimit(requestedLimit);
        List<SpoonacularRecipe> recipes = fetchPopularRecipes(limit);

        int created = 0;
        int updated = 0;

        for (SpoonacularRecipe externalRecipe : recipes) {
            Recipe recipe = recipeRepository.findBySpoonacularId(externalRecipe.id())
                    .orElseGet(Recipe::new);

            boolean isNewRecipe = recipe.getId() == null;
            recipe.setSpoonacularId(externalRecipe.id());
            recipe.setTitle(defaultString(externalRecipe.title()));
            recipe.setImage(externalRecipe.image());
            recipe.setSummary(externalRecipe.summary());
            recipe.setInstructions(externalRecipe.instructions());
            recipe.setServings(externalRecipe.servings());
            recipe.setReadyInMinutes(externalRecipe.readyInMinutes());
            recipe.setSourceUrl(externalRecipe.sourceUrl());
            recipe.setSpoonacularSourceUrl(externalRecipe.spoonacularSourceUrl());
            recipe.setHealthScore(externalRecipe.healthScore());
            recipe.setPricePerServing(externalRecipe.pricePerServing());
            recipe.setVegetarian(externalRecipe.vegetarian());
            recipe.setVegan(externalRecipe.vegan());
            recipe.setGlutenFree(externalRecipe.glutenFree());
            recipe.setDairyFree(externalRecipe.dairyFree());
            recipe.setVeryHealthy(externalRecipe.veryHealthy());
            recipe.setCheap(externalRecipe.cheap());
            recipe.setVeryPopular(externalRecipe.veryPopular());
            recipe.setSustainable(externalRecipe.sustainable());
            recipe.setLowFodmap(externalRecipe.lowFodmap());
            recipe.replaceIngredients(buildRecipeIngredients(externalRecipe.extendedIngredients()));
            recipe.replaceSteps(buildRecipeSteps(externalRecipe.analyzedInstructions()));
            recipe.replaceTags(buildRecipeTags(externalRecipe));
            recipe.replaceNutrition(buildRecipeNutrition(externalRecipe.nutrition()));

            recipeRepository.save(recipe);

            if (isNewRecipe) {
                created++;
            } else {
                updated++;
            }
        }

        return new SpoonacularImportResponseDto(limit, recipes.size(), created, updated);
    }

    private List<SpoonacularRecipe> fetchPopularRecipes(int limit) {
        Map<Long, SpoonacularRecipe> uniqueRecipes = new LinkedHashMap<>();

        for (String query : POPULAR_RECIPE_QUERIES) {
            if (uniqueRecipes.size() >= limit) {
                break;
            }

            List<SpoonacularRecipe> searchResults;
            try {
                searchResults = spoonacularClient.searchRecipes(apiKey, query, 2);
            } catch (Exception exception) {
                // Skip broken queries instead of failing the whole import batch.
                if (exception instanceof ResponseStatusException responseStatusException) {
                    HttpStatusCode statusCode = responseStatusException.getStatusCode();
                    if (statusCode.value() >= 400 && statusCode.value() < 500) {
                        continue;
                    }
                }
                continue;
            }

            for (SpoonacularRecipe recipe : searchResults) {
                if (recipe == null || recipe.id() == null || !hasMinimumRecipeData(recipe)) {
                    continue;
                }

                uniqueRecipes.putIfAbsent(recipe.id(), recipe);
                if (uniqueRecipes.size() >= limit) {
                    break;
                }
            }
        }

        return new ArrayList<>(uniqueRecipes.values());
    }

    private List<RecipeIngredient> buildRecipeIngredients(List<SpoonacularIngredient> externalIngredients) {
        if (externalIngredients == null || externalIngredients.isEmpty()) {
            return List.of();
        }

        List<RecipeIngredient> recipeIngredients = new ArrayList<>();
        for (SpoonacularIngredient externalIngredient : externalIngredients) {
            Ingredient ingredient = findOrCreateIngredient(externalIngredient);

            RecipeIngredient recipeIngredient = new RecipeIngredient();
            recipeIngredient.setIngredient(ingredient);
            recipeIngredient.setAmount(externalIngredient.amount());
            recipeIngredient.setUnit(externalIngredient.unit());
            recipeIngredient.setConsistency(externalIngredient.consistency());
            recipeIngredient.setAisle(externalIngredient.aisle());
            recipeIngredient.setOriginalText(externalIngredient.original());
            recipeIngredients.add(recipeIngredient);
        }

        return recipeIngredients;
    }

    private List<RecipeStep> buildRecipeSteps(List<AnalyzedInstruction> analyzedInstructions) {
        if (analyzedInstructions == null || analyzedInstructions.isEmpty()) {
            return List.of();
        }

        List<RecipeStep> recipeSteps = new ArrayList<>();
        for (AnalyzedInstruction instruction : analyzedInstructions) {
            if (instruction == null || instruction.steps() == null) {
                continue;
            }

            for (InstructionStep step : instruction.steps()) {
                if (step == null || step.number() == null || isBlank(step.step())) {
                    continue;
                }

                RecipeStep recipeStep = new RecipeStep();
                recipeStep.setStepNumber(step.number());
                recipeStep.setInstruction(step.step().trim());
                recipeSteps.add(recipeStep);
            }
        }

        return recipeSteps;
    }

    private List<RecipeTag> buildRecipeTags(SpoonacularRecipe recipe) {
        List<RecipeTag> tags = new ArrayList<>();
        addTags(tags, "dish_type", recipe.dishTypes());
        addTags(tags, "diet", recipe.diets());
        addTags(tags, "cuisine", recipe.cuisines());
        addTags(tags, "occasion", recipe.occasions());
        return tags;
    }

    private void addTags(List<RecipeTag> tags, String type, List<String> values) {
        if (values == null || values.isEmpty()) {
            return;
        }

        Set<String> seen = new HashSet<>();
        for (String value : values) {
            String normalized = defaultString(value);
            if (normalized.isBlank() || !seen.add(normalized.toLowerCase())) {
                continue;
            }

            RecipeTag tag = new RecipeTag();
            tag.setTagType(type);
            tag.setTagValue(normalized);
            tags.add(tag);
        }
    }

    private RecipeNutrition buildRecipeNutrition(Nutrition nutrition) {
        if (nutrition == null || nutrition.nutrients() == null || nutrition.nutrients().isEmpty()) {
            return null;
        }

        RecipeNutrition recipeNutrition = new RecipeNutrition();
        recipeNutrition.setCalories(findNutrientAmount(nutrition.nutrients(), "Calories"));
        recipeNutrition.setProtein(findNutrientAmount(nutrition.nutrients(), "Protein"));
        recipeNutrition.setFat(findNutrientAmount(nutrition.nutrients(), "Fat"));
        recipeNutrition.setCarbs(findNutrientAmount(nutrition.nutrients(), "Carbohydrates"));
        recipeNutrition.setFiber(findNutrientAmount(nutrition.nutrients(), "Fiber"));
        recipeNutrition.setSugar(findNutrientAmount(nutrition.nutrients(), "Sugar"));
        recipeNutrition.setSodium(findNutrientAmount(nutrition.nutrients(), "Sodium"));
        return recipeNutrition;
    }

    private Ingredient findOrCreateIngredient(SpoonacularIngredient externalIngredient) {
        String normalizedName = defaultString(externalIngredient.name());

        Ingredient ingredient = null;
        if (externalIngredient.id() != null) {
            ingredient = ingredientRepository.findBySpoonacularId(externalIngredient.id()).orElse(null);
        }

        if (ingredient == null && !normalizedName.isBlank()) {
            ingredient = ingredientRepository.findByNameIgnoreCase(normalizedName).orElse(null);
        }

        if (ingredient == null) {
            ingredient = new Ingredient();
        }

        ingredient.setSpoonacularId(externalIngredient.id());
        ingredient.setName(normalizedName.isBlank() ? "Unknown ingredient" : normalizedName);
        ingredient.setOriginalName(defaultString(externalIngredient.originalName()));
        ingredient.setImage(externalIngredient.image());
        return ingredientRepository.save(ingredient);
    }

    private int normalizeLimit(int requestedLimit) {
        if (requestedLimit < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limit must be at least 1");
        }

        if (requestedLimit > maxImportLimit) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Limit cannot be greater than " + maxImportLimit
            );
        }

        return requestedLimit;
    }

    private boolean hasMinimumRecipeData(SpoonacularRecipe recipe) {
        return recipe.title() != null
                && !recipe.title().isBlank()
                && recipe.extendedIngredients() != null
                && !recipe.extendedIngredients().isEmpty();
    }

    private Double findNutrientAmount(List<Nutrient> nutrients, String targetName) {
        for (Nutrient nutrient : nutrients) {
            if (nutrient == null || nutrient.name() == null) {
                continue;
            }

            if (targetName.equalsIgnoreCase(nutrient.name().trim())) {
                return nutrient.amount();
            }
        }

        return null;
    }

    private String defaultString(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
