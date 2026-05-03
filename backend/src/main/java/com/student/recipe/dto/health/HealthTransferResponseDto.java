package com.student.recipe.dto.health;

import java.time.LocalDate;

public record HealthTransferResponseDto(
        boolean success,
        Long id,
        Integer adim,
        Double kalori,
        LocalDate date,
        String message
) {
}