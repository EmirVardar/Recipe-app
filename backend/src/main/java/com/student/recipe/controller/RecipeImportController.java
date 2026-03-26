package com.student.recipe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.dto.SpoonacularImportResponseDto;
import com.student.recipe.service.RecipeImportService;

@RestController
@RequestMapping("/api/import")
public class RecipeImportController {

    private final RecipeImportService recipeImportService;

    public RecipeImportController(RecipeImportService recipeImportService) {
        this.recipeImportService = recipeImportService;
    }

    @PostMapping("/spoonacular/popular")
    public ResponseEntity<SpoonacularImportResponseDto> importPopularRecipes(
            @RequestParam(defaultValue = "5") int limit
    ) {
        return ResponseEntity.ok(recipeImportService.importPopularRecipes(limit));
    }
}
