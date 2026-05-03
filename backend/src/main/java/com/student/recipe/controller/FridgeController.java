package com.student.recipe.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.dto.fridge.FridgeItemCreateRequestDto;
import com.student.recipe.dto.fridge.FridgeItemResponseDto;
import com.student.recipe.service.UserFridgeService;

@RestController
@RequestMapping("/api/fridge")
public class FridgeController {

    private final UserFridgeService userFridgeService;

    public FridgeController(UserFridgeService userFridgeService) {
        this.userFridgeService = userFridgeService;
    }

    @GetMapping("/items")
    public ResponseEntity<List<FridgeItemResponseDto>> getItems(Authentication authentication) {
        return ResponseEntity.ok(userFridgeService.getItems(authentication.getName()));
    }

    @PostMapping("/items")
    public ResponseEntity<FridgeItemResponseDto> addItem(
            Authentication authentication,
            @RequestBody FridgeItemCreateRequestDto request
    ) {
        return ResponseEntity.ok(userFridgeService.addItem(authentication.getName(), request));
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<FridgeItemResponseDto> updateItem(
            Authentication authentication,
            @PathVariable Long itemId,
            @RequestBody FridgeItemCreateRequestDto request
    ) {
        return ResponseEntity.ok(userFridgeService.updateItem(authentication.getName(), itemId, request));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> deleteItem(
            Authentication authentication,
            @PathVariable Long itemId
    ) {
        userFridgeService.deleteItem(authentication.getName(), itemId);
        return ResponseEntity.noContent().build();
    }
}
