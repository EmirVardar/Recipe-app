package com.student.recipe.dto.user;

public record OnboardingStatusResponseDto(
        boolean profileCompleted,
        boolean medicalCompleted,
        boolean nutritionCompleted,
        boolean completed
) {
}
