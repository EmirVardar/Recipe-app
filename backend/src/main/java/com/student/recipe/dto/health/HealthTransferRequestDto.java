package com.student.recipe.dto.health;

import java.time.LocalDate;

public record HealthTransferRequestDto(
        Integer adim,
        Double kalori,
        LocalDate date
) {
}