package com.student.recipe.controller;

import java.time.LocalDate;

import com.student.recipe.dto.meal.RecipeMealLogItemCreateRequestDto;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import com.student.recipe.dto.meal.DailyMealLogsResponseDto;
import com.student.recipe.dto.meal.MealLogItemCreateRequestDto;
import com.student.recipe.dto.meal.MealLogItemResponseDto;
import com.student.recipe.service.MealTrackingService;

@RestController
@RequestMapping("/api/meals")
public class MealController {

    private final MealTrackingService mealTrackingService;

    public MealController(MealTrackingService mealTrackingService) {
        this.mealTrackingService = mealTrackingService;
    }

    @PostMapping("/items")
    public ResponseEntity<MealLogItemResponseDto> addMealItem(
            Authentication authentication,
            @RequestBody MealLogItemCreateRequestDto request
    ) {
        return ResponseEntity.ok(mealTrackingService.addMealItem(authentication.getName(), request));
    }

    @GetMapping
    public ResponseEntity<DailyMealLogsResponseDto> getDailyMeals(
            Authentication authentication,
            @RequestParam(required = false) LocalDate date
    ) {
        return ResponseEntity.ok(mealTrackingService.getDailyMeals(authentication.getName(), date));
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<MealLogItemResponseDto> updateMealItem(
            Authentication authentication,
            @PathVariable Long itemId,
            @RequestBody MealLogItemCreateRequestDto request
    ) {
        return ResponseEntity.ok(mealTrackingService.updateMealItem(authentication.getName(), itemId, request));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> deleteMealItem(
            Authentication authentication,
            @PathVariable Long itemId
    ) {
        mealTrackingService.deleteMealItem(authentication.getName(), itemId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/items/recipe")
    public ResponseEntity<MealLogItemResponseDto> addRecipeMealItem(
            Authentication authentication,
            @RequestBody RecipeMealLogItemCreateRequestDto request
    ) {
        return ResponseEntity.ok(mealTrackingService.addRecipeMealItem(authentication.getName(), request));
    }

    @PutMapping("/items/{itemId}/recipe")
    public ResponseEntity<MealLogItemResponseDto> updateRecipeMealItem(
            Authentication authentication,
            @PathVariable Long itemId,
            @RequestBody RecipeMealLogItemCreateRequestDto request
    ) {
        return ResponseEntity.ok(mealTrackingService.updateRecipeMealItem(authentication.getName(), itemId, request));
    }
}
