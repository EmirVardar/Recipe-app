package com.student.recipe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.dto.user.MedicalResponseDto;
import com.student.recipe.dto.user.MedicalUpdateRequestDto;
import com.student.recipe.dto.user.NutritionPreferenceResponseDto;
import com.student.recipe.dto.user.NutritionPreferenceUpdateRequestDto;
import com.student.recipe.dto.user.OnboardingStatusResponseDto;
import com.student.recipe.dto.user.ProfileResponseDto;
import com.student.recipe.dto.user.ProfileUpdateRequestDto;
import com.student.recipe.service.UserHealthService;

@RestController
@RequestMapping("/api")
public class UserHealthController {

    private final UserHealthService userHealthService;

    public UserHealthController(UserHealthService userHealthService) {
        this.userHealthService = userHealthService;
    }

    @GetMapping("/onboarding/status")
    public ResponseEntity<OnboardingStatusResponseDto> onboardingStatus(Authentication authentication) {
        return ResponseEntity.ok(userHealthService.getOnboardingStatus(authentication.getName()));
    }

    @GetMapping("/me/profile")
    public ResponseEntity<ProfileResponseDto> profile(Authentication authentication) {
        return ResponseEntity.ok(userHealthService.getProfile(authentication.getName()));
    }

    @GetMapping("/me/medical")
    public ResponseEntity<MedicalResponseDto> medical(Authentication authentication) {
        return ResponseEntity.ok(userHealthService.getMedical(authentication.getName()));
    }

    @GetMapping("/me/nutrition")
    public ResponseEntity<NutritionPreferenceResponseDto> nutrition(Authentication authentication) {
        return ResponseEntity.ok(userHealthService.getNutrition(authentication.getName()));
    }

    @PutMapping("/me/profile")
    public ResponseEntity<ProfileResponseDto> upsertProfile(
            Authentication authentication,
            @RequestBody ProfileUpdateRequestDto request
    ) {
        return ResponseEntity.ok(userHealthService.upsertProfile(authentication.getName(), request));
    }

    @PutMapping("/me/medical")
    public ResponseEntity<MedicalResponseDto> upsertMedical(
            Authentication authentication,
            @RequestBody MedicalUpdateRequestDto request
    ) {
        return ResponseEntity.ok(userHealthService.upsertMedical(authentication.getName(), request));
    }

    @PutMapping("/me/nutrition")
    public ResponseEntity<NutritionPreferenceResponseDto> upsertNutrition(
            Authentication authentication,
            @RequestBody NutritionPreferenceUpdateRequestDto request
    ) {
        return ResponseEntity.ok(userHealthService.upsertNutrition(authentication.getName(), request));
    }
}
