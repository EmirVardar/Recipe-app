package com.student.recipe.dto.auth;

public record RegisterRequestDto(
        String email,
        String password,
        String fullName
) {
}
