package com.student.recipe.dto.auth;

public record LoginRequestDto(
        String email,
        String password
) {
}
