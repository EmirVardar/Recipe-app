package com.student.recipe.controller;

import com.student.recipe.vector.VectorIndexingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/vector")
@RequiredArgsConstructor
public class VectorIndexController {

    private final VectorIndexingService vectorIndexingService;

    @PostMapping("/index/recipes")
    public Map<String, Object> indexRecipes() {
        int count = vectorIndexingService.indexAllRecipes();
        return Map.of("indexed", count, "type", "recipes");
    }

    @PostMapping("/index/foods")
    public Map<String, Object> indexFoods() {
        int count = vectorIndexingService.indexAllFoodProducts();
        return Map.of("indexed", count, "type", "food_products");
    }
}