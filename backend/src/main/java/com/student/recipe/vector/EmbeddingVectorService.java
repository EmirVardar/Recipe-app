package com.student.recipe.vector;

import com.student.recipe.entity.FoodProduct;
import com.student.recipe.entity.Recipe;
import com.student.recipe.entity.RecipeStep;
import com.student.recipe.entity.RecipeTag;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.output.Response;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmbeddingVectorService {

    private static final String COLLECTION = "recipe_kg";

    private final ChromaClient chroma;
    private final EmbeddingModel embeddingModel;

    @PostConstruct
    void init() {
        chroma.ensure(COLLECTION);
    }

    public void indexRecipe(Recipe recipe) {
        String vectorId = "recipe_" + recipe.getId();
        String doc = buildRecipeDocument(recipe);
        Map<String, Object> metadata = buildRecipeMetadata(recipe);
        List<Float> vector = embed(doc);
        chroma.upsert(COLLECTION, vectorId, vector, metadata, doc);
    }

    public void indexFoodProduct(FoodProduct food) {
        String vectorId = "food_" + food.getId();
        String doc = buildFoodDocument(food);
        Map<String, Object> metadata = buildFoodMetadata(food);
        List<Float> vector = embed(doc);
        chroma.upsert(COLLECTION, vectorId, vector, metadata, doc);
    }

    public List<DocumentMatch> findRelevant(String query, int topK) {
        List<Float> vector = embed(query);
        Map<?, ?> result = chroma.query(vector, topK);
        List<DocumentMatch> matches = parseQueryResult(result);

        // Bunu ekle:
        matches.forEach(m -> log.info("Match: distance={} text={}",
                m.distance(), m.text().substring(0, Math.min(80, m.text().length()))));

        return matches;
    }

    private String buildRecipeDocument(Recipe recipe) {
        StringBuilder sb = new StringBuilder();
        sb.append("Recipe: ").append(resolveRecipeTitle(recipe)).append("\n");

        List<String> flags = new ArrayList<>();
        if (Boolean.TRUE.equals(recipe.getVegetarian())) flags.add("vegetarian");
        if (Boolean.TRUE.equals(recipe.getVegan()))       flags.add("vegan");
        if (Boolean.TRUE.equals(recipe.getGlutenFree()))  flags.add("gluten-free");
        if (Boolean.TRUE.equals(recipe.getDairyFree()))   flags.add("dairy-free");
        if (Boolean.TRUE.equals(recipe.getLowFodmap()))   flags.add("low-fodmap");
        if (!flags.isEmpty())
            sb.append("Diet: ").append(String.join(", ", flags)).append("\n");

        List<String> tags = recipe.getRecipeTags().stream()
                .map(this::resolveTagValue)
                .toList();
        if (!tags.isEmpty())
            sb.append("Tags: ").append(String.join(", ", tags)).append("\n");

        List<String> ingredients = recipe.getRecipeIngredients().stream()
                .map(ri -> resolveIngredientName(ri.getIngredient()))
                .toList();
        if (!ingredients.isEmpty())
            sb.append("Ingredients: ").append(String.join(", ", ingredients)).append("\n");

        if (recipe.getReadyInMinutes() != null)
            sb.append("Ready in: ").append(recipe.getReadyInMinutes()).append(" minutes\n");

        var n = recipe.getRecipeNutrition();
        if (n != null) {
            sb.append("Nutrition per serving: ");
            if (n.getCalories() != null) sb.append(n.getCalories().intValue()).append(" kcal, ");
            if (n.getProtein()  != null) sb.append(n.getProtein().intValue()).append("g protein, ");
            if (n.getCarbs()    != null) sb.append(n.getCarbs().intValue()).append("g carbs, ");
            if (n.getFat()      != null) sb.append(n.getFat().intValue()).append("g fat");
            sb.append("\n");
        }

        recipe.getRecipeSteps().stream()
                .sorted(Comparator.comparing(RecipeStep::getStepNumber))
                .limit(3)
                .forEach(s -> sb.append("Step ").append(s.getStepNumber())
                        .append(": ").append(resolveStepInstruction(s)).append("\n"));

        return sb.toString().trim();
    }

    private Map<String, Object> buildRecipeMetadata(Recipe recipe) {
        return Map.of(
                "kind",             "recipe",
                "id",               String.valueOf(recipe.getId()),
                "title",            resolveRecipeTitle(recipe),
                "vegan",            String.valueOf(Boolean.TRUE.equals(recipe.getVegan())),
                "vegetarian",       String.valueOf(Boolean.TRUE.equals(recipe.getVegetarian())),
                "gluten_free",      String.valueOf(Boolean.TRUE.equals(recipe.getGlutenFree())),
                "dairy_free",       String.valueOf(Boolean.TRUE.equals(recipe.getDairyFree())),
                "ready_in_minutes", String.valueOf(recipe.getReadyInMinutes() != null ? recipe.getReadyInMinutes() : 0),
                "source_url",       recipe.getSourceUrl() != null ? recipe.getSourceUrl() : ""
        );
    }

    private String buildFoodDocument(FoodProduct food) {
        return String.format("""
                Food: %s
                Per 100g: %.0f kcal, %.1fg protein, %.1fg carbs, %.1fg fat
                """,
                resolveFoodName(food),
                orZero(food.getCaloriesPer100g()),
                orZero(food.getProteinPer100g()),
                orZero(food.getCarbsPer100g()),
                orZero(food.getFatPer100g())
        ).trim();
    }

    private Map<String, Object> buildFoodMetadata(FoodProduct food) {
        return Map.of(
                "kind",    "food",
                "id",      String.valueOf(food.getId()),
                "name",    resolveFoodName(food),
                "calories", String.valueOf(orZero(food.getCaloriesPer100g()).intValue()),
                "protein", String.valueOf(orZero(food.getProteinPer100g()))
        );
    }

    private List<Float> embed(String text) {
        Response<Embedding> response = embeddingModel.embed(text);
        return response.content().vectorAsList();
    }

    @SuppressWarnings("unchecked")
    private List<DocumentMatch> parseQueryResult(Map<?, ?> result) {
        List<DocumentMatch> matches = new ArrayList<>();

        List<List<String>>              docLists  = (List<List<String>>)              result.get("documents");
        List<List<Map<String, Object>>> metaLists = (List<List<Map<String, Object>>>) result.get("metadatas");
        List<List<Double>>              distLists = (List<List<Double>>)              result.get("distances");

        if (docLists == null || docLists.isEmpty()) return matches;

        List<String>              docs  = docLists.get(0);
        List<Map<String, Object>> metas = metaLists.get(0);
        List<Double>              dists = distLists.get(0);

        for (int i = 0; i < docs.size(); i++) {
            matches.add(new DocumentMatch(docs.get(i), metas.get(i), dists.get(i)));
        }

        matches.sort(Comparator.comparingDouble(DocumentMatch::distance));
        return matches;
    }

    private Double orZero(Double v) {
        return v != null ? v : 0.0;
    }

    private String resolveRecipeTitle(Recipe recipe) {
        if (recipe.getTitleTr() != null && !recipe.getTitleTr().isBlank()) {
            return recipe.getTitleTr();
        }
        return recipe.getTitle() != null ? recipe.getTitle() : "";
    }

    private String resolveTagValue(RecipeTag tag) {
        if (tag.getTagValueTr() != null && !tag.getTagValueTr().isBlank()) {
            return tag.getTagValueTr();
        }
        return tag.getTagValue() != null ? tag.getTagValue() : "";
    }

    private String resolveIngredientName(com.student.recipe.entity.Ingredient ingredient) {
        if (ingredient.getNameTr() != null && !ingredient.getNameTr().isBlank()) {
            return ingredient.getNameTr();
        }
        return ingredient.getName() != null ? ingredient.getName() : "";
    }

    private String resolveStepInstruction(RecipeStep step) {
        if (step.getInstructionTr() != null && !step.getInstructionTr().isBlank()) {
            return step.getInstructionTr();
        }
        return step.getInstruction() != null ? step.getInstruction() : "";
    }

    private String resolveFoodName(FoodProduct food) {
        if (food.getNameTr() != null && !food.getNameTr().isBlank()) {
            return food.getNameTr();
        }
        return food.getName() != null ? food.getName() : "";
    }
}
