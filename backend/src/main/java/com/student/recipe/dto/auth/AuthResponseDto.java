package com.student.recipe.dto.auth;

public record AuthResponseDto(
        Long id,
        String email,
        String fullName,
        String accessToken,
        String message
) {
}
