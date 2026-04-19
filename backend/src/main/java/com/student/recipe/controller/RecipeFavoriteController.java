package com.student.recipe.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.service.RecipeFavoriteService;

@RestController
@RequestMapping("/api/recipes/favorites")
public class RecipeFavoriteController {

    private final RecipeFavoriteService recipeFavoriteService;

    public RecipeFavoriteController(RecipeFavoriteService recipeFavoriteService) {
        this.recipeFavoriteService = recipeFavoriteService;
    }

    @PostMapping("/{recipeId}")
    public ResponseEntity<Map<String, Object>> addFavorite(@PathVariable Long recipeId, Authentication authentication) {
        recipeFavoriteService.addFavorite(authentication.getName(), recipeId);
        return ResponseEntity.ok(Map.of("recipeId", recipeId, "favorited", true));
    }

    @DeleteMapping("/{recipeId}")
    public ResponseEntity<Map<String, Object>> removeFavorite(@PathVariable Long recipeId, Authentication authentication) {
        recipeFavoriteService.removeFavorite(authentication.getName(), recipeId);
        return ResponseEntity.ok(Map.of("recipeId", recipeId, "favorited", false));
    }
}
