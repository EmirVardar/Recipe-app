package com.student.recipe.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.dto.food.FoodProductSearchItemDto;
import com.student.recipe.service.FoodProductQueryService;

@RestController
@RequestMapping("/api/foods")
public class FoodProductController {

    private final FoodProductQueryService foodProductQueryService;

    public FoodProductController(FoodProductQueryService foodProductQueryService) {
        this.foodProductQueryService = foodProductQueryService;
    }

    @GetMapping
    public ResponseEntity<List<FoodProductSearchItemDto>> searchFoods(
            @RequestParam String q,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(foodProductQueryService.search(q, limit));
    }

    @GetMapping("/best-match")
    public ResponseEntity<FoodProductSearchItemDto> getBestFoodMatch(@RequestParam String q) {
        return foodProductQueryService.findBestMatch(q)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
