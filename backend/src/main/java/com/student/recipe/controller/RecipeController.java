package com.student.recipe.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.dto.recipe.RecipeDetailDto;
import com.student.recipe.dto.recipe.RecipeListItemDto;
import com.student.recipe.service.RecipeQueryService;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    private final RecipeQueryService recipeQueryService;

    public RecipeController(RecipeQueryService recipeQueryService) {
        this.recipeQueryService = recipeQueryService;
    }

    @GetMapping
    public ResponseEntity<List<RecipeListItemDto>> listRecipes(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Double minCalories,
            @RequestParam(required = false) Double maxCalories,
            @RequestParam(required = false) Boolean highProtein,
            @RequestParam(required = false) Integer maxReadyInMinutes,
            @RequestParam(required = false) Boolean vegetarian,
            @RequestParam(required = false) Boolean vegan,
            @RequestParam(required = false) String category,
            Authentication authentication
    ) {
        return ResponseEntity.ok(recipeQueryService.listRecipes(
                authentication.getName(),
                q,
                minCalories,
                maxCalories,
                highProtein,
                maxReadyInMinutes,
                vegetarian,
                vegan,
                category
        ));
    }

    @GetMapping("/favorites")
    public ResponseEntity<List<RecipeListItemDto>> listFavoriteRecipes(Authentication authentication) {
        return ResponseEntity.ok(recipeQueryService.listFavoriteRecipes(authentication.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RecipeDetailDto> getRecipe(@PathVariable Long id) {
        return ResponseEntity.ok(recipeQueryService.getRecipeDetail(id));
    }
}
