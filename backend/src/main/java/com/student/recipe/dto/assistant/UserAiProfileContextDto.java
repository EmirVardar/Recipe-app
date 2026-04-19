package com.student.recipe.dto.assistant;

import java.util.List;

public record UserAiProfileContextDto(
        Integer age,
        String sex,
        Double heightCm,
        Double weightKg,
        String activityLevel,
        String goal,
        List<String> chronicConditions,
        List<String> medications,
        List<String> allergies,
        List<String> intolerances,
        String dietType,
        List<String> avoidFoods,
        List<String> preferredFoods,
        String budgetLevel
) {
}
