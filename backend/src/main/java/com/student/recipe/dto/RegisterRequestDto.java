package com.student.recipe.dto;

public record RegisterRequestDto(
        String email,
        String password,
        String fullName
) {
}
