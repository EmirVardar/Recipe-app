package com.student.recipe.integration.spoonacular;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Component
public class SpoonacularClient {

    private static final Logger log = LoggerFactory.getLogger(SpoonacularClient.class);

    private final RestClient restClient;

    public SpoonacularClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder
                .baseUrl("https://api.spoonacular.com")
                .build();
    }

    public RandomRecipesResponse fetchRandomRecipes(String apiKey, int limit) {
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/recipes/random")
                        .queryParam("apiKey", apiKey)
                        .queryParam("number", limit)
                        .build())
                .retrieve()
                .body(RandomRecipesResponse.class);
    }

    public List<SpoonacularRecipe> searchRecipes(String apiKey, String query, int limit) {
        SearchRecipesResponse response;
        try {
            response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/recipes/complexSearch")
                            .queryParam("apiKey", apiKey)
                            .queryParam("query", query)
                            .queryParam("number", limit)
                            .queryParam("addRecipeInformation", true)
                            .queryParam("fillIngredients", true)
                            .queryParam("addRecipeNutrition", true)
                            .queryParam("instructionsRequired", true)
                            .build())
                    .retrieve()
                    .body(SearchRecipesResponse.class);
        } catch (RestClientResponseException exception) {
            log.error(
                    "Spoonacular search failed. status={} query='{}' body={}",
                    exception.getStatusCode(),
                    query,
                    exception.getResponseBodyAsString()
            );
            throw new ResponseStatusException(
                    exception.getStatusCode(),
                    "Spoonacular request failed: " + exception.getResponseBodyAsString(),
                    exception
            );
        }

        if (response == null || response.results() == null) {
            return List.of();
        }

        return new ArrayList<>(response.results());
    }

    public record RandomRecipesResponse(
            List<SpoonacularRecipe> recipes
    ) {
    }

    public record SearchRecipesResponse(
            List<SpoonacularRecipe> results
    ) {
    }

    public record SpoonacularRecipe(
            Long id,
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
            List<String> dishTypes,
            List<String> diets,
            List<String> cuisines,
            List<String> occasions,
            List<AnalyzedInstruction> analyzedInstructions,
            Nutrition nutrition,
            List<SpoonacularIngredient> extendedIngredients
    ) {
    }

    public record SpoonacularIngredient(
            Long id,
            String name,
            String originalName,
            String image,
            Double amount,
            String unit,
            String consistency,
            String aisle,
            String original
    ) {
    }

    public record AnalyzedInstruction(
            String name,
            List<InstructionStep> steps
    ) {
    }

    public record InstructionStep(
            Integer number,
            String step
    ) {
    }

    public record Nutrition(
            List<Nutrient> nutrients
    ) {
    }

    public record Nutrient(
            String name,
            Double amount,
            String unit
    ) {
    }
}
