package com.student.recipe.dto;

import java.time.Instant;

public record HealthTransferResponseDto(
        boolean success,
        Long id,
        Integer adim,
        Double kalori,
        Instant createdAt,
        String message
) {
}
