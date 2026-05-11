package com.student.recipe.controller;

import com.student.recipe.service.TranslationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/translation")
public class TranslationController {

    private final TranslationService translationService;

    public TranslationController(TranslationService translationService) {
        this.translationService = translationService;
    }

    @PostMapping("/food-products")
    public ResponseEntity<Map<String, Object>> startFoodTranslation() {
        translationService.translateFoodProducts();
        return ResponseEntity.ok(Map.of(
                "status", "started",
                "message", "Food product translation started. Use /food-products/status to track."
        ));
    }

    @GetMapping("/food-products/status")
    public ResponseEntity<Map<String, Object>> getFoodStatus() {
        TranslationService.JobStatus status = translationService.getFoodStatus();
        return ResponseEntity.ok(Map.of(
                "running", status.running(),
                "translated", status.translated(),
                "failed", status.failed()
        ));
    }

    @PostMapping("/ingredients")
    public ResponseEntity<Map<String, Object>> startIngredientTranslation() {
        translationService.translateIngredients();
        return ResponseEntity.ok(Map.of(
                "status", "started",
                "message", "Ingredient translation started. Use /ingredients/status to track."
        ));
    }

    @GetMapping("/ingredients/status")
    public ResponseEntity<Map<String, Object>> getIngredientStatus() {
        TranslationService.JobStatus status = translationService.getIngredientStatus();
        return ResponseEntity.ok(Map.of(
                "running", status.running(),
                "translated", status.translated(),
                "failed", status.failed()
        ));
    }

    @PostMapping("/recipes/titles")
    public ResponseEntity<Map<String, Object>> startRecipeTitleTranslation() {
        translationService.translateRecipeTitles();
        return ResponseEntity.ok(Map.of(
                "status", "started",
                "message", "Recipe title translation started. Use /recipes/titles/status to track."
        ));
    }

    @GetMapping("/recipes/titles/status")
    public ResponseEntity<Map<String, Object>> getRecipeTitleStatus() {
        TranslationService.JobStatus status = translationService.getRecipeTitleStatus();
        return ResponseEntity.ok(Map.of(
                "running", status.running(),
                "translated", status.translated(),
                "failed", status.failed()
        ));
    }

    @PostMapping("/recipes/steps")
    public ResponseEntity<Map<String, Object>> startRecipeStepTranslation() {
        translationService.translateRecipeSteps();
        return ResponseEntity.ok(Map.of(
                "status", "started",
                "message", "Recipe step translation started. Use /recipes/steps/status to track."
        ));
    }

    @GetMapping("/recipes/steps/status")
    public ResponseEntity<Map<String, Object>> getRecipeStepStatus() {
        TranslationService.JobStatus status = translationService.getRecipeStepStatus();
        return ResponseEntity.ok(Map.of(
                "running", status.running(),
                "translated", status.translated(),
                "failed", status.failed()
        ));
    }

    @PostMapping("/recipes/tags")
    public ResponseEntity<Map<String, Object>> startRecipeTagTranslation() {
        translationService.translateRecipeTags();
        return ResponseEntity.ok(Map.of(
                "status", "started",
                "message", "Recipe tag translation started. Use /recipes/tags/status to track."
        ));
    }

    @GetMapping("/recipes/tags/status")
    public ResponseEntity<Map<String, Object>> getRecipeTagStatus() {
        TranslationService.JobStatus status = translationService.getRecipeTagStatus();
        return ResponseEntity.ok(Map.of(
                "running", status.running(),
                "translated", status.translated(),
                "failed", status.failed()
        ));
    }
}
