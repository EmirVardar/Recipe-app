package com.student.recipe.dto;

public record AuthResponseDto(
        Long id,
        String email,
        String fullName,
        String accessToken,
        String message
) {
}
