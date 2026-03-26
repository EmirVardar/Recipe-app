package com.student.recipe.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.dto.RecipeDetailDto;
import com.student.recipe.dto.RecipeListItemDto;
import com.student.recipe.service.RecipeQueryService;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    private final RecipeQueryService recipeQueryService;

    public RecipeController(RecipeQueryService recipeQueryService) {
        this.recipeQueryService = recipeQueryService;
    }

    @GetMapping
    public ResponseEntity<List<RecipeListItemDto>> listRecipes() {
        return ResponseEntity.ok(recipeQueryService.listRecipes());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RecipeDetailDto> getRecipe(@PathVariable Long id) {
        return ResponseEntity.ok(recipeQueryService.getRecipeDetail(id));
    }
}
