package com.student.recipe.vector;

import com.student.recipe.entity.FoodProduct;
import com.student.recipe.entity.Recipe;
import com.student.recipe.repository.FoodProductRepository;
import com.student.recipe.repository.RecipeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class VectorIndexingService {

    private final RecipeRepository recipeRepository;
    private final FoodProductRepository foodProductRepository;
    private final EmbeddingVectorService vectorService;

    @Transactional(readOnly = true)
    public int indexAllRecipes() {
        List<Long> ids = recipeRepository.findAllIds();
        log.info("Total recipe ids found: {}", ids.size());
        int count = 0;
        for (Long id : ids) {
            try {
                Recipe recipe = recipeRepository.findByIdWithIngredientsAndNutrition(id).orElse(null);
                if (recipe == null) continue;

                // Tags ve steps lazy yükle
                recipeRepository.findByIdWithTags(id)
                        .ifPresent(r -> recipe.getRecipeTags().addAll(r.getRecipeTags()));
                recipeRepository.findByIdWithSteps(id)
                        .ifPresent(r -> recipe.getRecipeSteps().addAll(r.getRecipeSteps()));

                vectorService.indexRecipe(recipe);
                count++;
            } catch (Exception e) {
                log.error("Recipe index failed: id={}", id, e);
            }
        }
        log.info("Indexed {} recipes", count);
        return count;
    }

    @Transactional(readOnly = true)
    public int indexAllFoodProducts() {
        int page = 0, size = 500, total = 0;
        List<FoodProduct> batch;
        do {
            batch = foodProductRepository.findAll(PageRequest.of(page++, size)).getContent();
            for (FoodProduct food : batch) {
                try {
                    vectorService.indexFoodProduct(food);
                    total++;
                } catch (Exception e) {
                    log.error("Food index failed: id={}", food.getId(), e);
                }
            }
        } while (!batch.isEmpty());
        log.info("Indexed {} food products", total);
        return total;
    }
}