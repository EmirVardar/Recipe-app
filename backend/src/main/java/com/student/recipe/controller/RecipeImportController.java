package com.student.recipe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.dto.SpoonacularQuerySeedImportResponseDto;
import com.student.recipe.dto.SpoonacularImportResponseDto;
import com.student.recipe.service.RecipeImportService;
import com.student.recipe.service.SpoonacularQuerySeedImportService;

@RestController
@RequestMapping("/api/import")
public class RecipeImportController {

    private final RecipeImportService recipeImportService;
    private final SpoonacularQuerySeedImportService spoonacularQuerySeedImportService;

    public RecipeImportController(
            RecipeImportService recipeImportService,
            SpoonacularQuerySeedImportService spoonacularQuerySeedImportService
    ) {
        this.recipeImportService = recipeImportService;
        this.spoonacularQuerySeedImportService = spoonacularQuerySeedImportService;
    }

    @PostMapping("/spoonacular/popular")
    public ResponseEntity<SpoonacularImportResponseDto> importPopularRecipes(
            @RequestParam(defaultValue = "5") int limit
    ) {
        return ResponseEntity.ok(recipeImportService.importPopularRecipes(limit));
    }

    @PostMapping("/spoonacular/query-seeds")
    public ResponseEntity<SpoonacularQuerySeedImportResponseDto> importQuerySeeds(
            @RequestParam(defaultValue = "100") int limit
    ) {
        return ResponseEntity.ok(spoonacularQuerySeedImportService.importQueries(limit));
    }
}
