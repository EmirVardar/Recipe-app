package com.student.recipe.dto;

public record OnboardingStatusResponseDto(
        boolean profileCompleted,
        boolean medicalCompleted,
        boolean nutritionCompleted,
        boolean completed
) {
}
