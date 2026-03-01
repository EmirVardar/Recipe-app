package com.student.recipe.dto;

public record AuthResponseDto(
        Long id,
        String email,
        String fullName,
        Double heightCm,
        Double weightKg,
        String accessToken,
        String message
) {
}
