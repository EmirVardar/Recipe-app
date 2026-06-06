package com.student.recipe.service.assistant;

import org.springframework.stereotype.Service;

import com.student.recipe.dto.assistant.UserAiProfileContextDto;

@Service
public class DailyCalorieTargetService {

    private static final double STEP_CALORIE_BURN = 0.04;

    public DailyCalorieSummary summarize(UserAiProfileContextDto context, double consumedCalories, double burnedCalories) {
        Integer targetCalories = calculateDailyTarget(context);
        double netCalories = consumedCalories - burnedCalories;
        Double remainingCalories = null;
        Integer suggestedExtraSteps = null;

        if (targetCalories != null) {
            remainingCalories = targetCalories - netCalories;
            if (remainingCalories < 0) {
                suggestedExtraSteps = (int) Math.ceil(Math.abs(remainingCalories) / STEP_CALORIE_BURN);
            }
        }

        return new DailyCalorieSummary(
                targetCalories,
                consumedCalories,
                burnedCalories,
                netCalories,
                remainingCalories,
                suggestedExtraSteps
        );
    }

    public Integer calculateDailyTarget(UserAiProfileContextDto context) {
        if (context == null
                || context.age() == null
                || context.heightCm() == null
                || context.weightKg() == null) {
            return null;
        }

        double bmr = calculateBmr(context);
        double tdee = bmr * resolveActivityMultiplier(context.activityLevel());
        double adjustedTarget = tdee + resolveGoalAdjustment(context.goal());

        return (int) Math.round(Math.max(1200.0, adjustedTarget));
    }

    private double calculateBmr(UserAiProfileContextDto context) {
        double weight = context.weightKg();
        double height = context.heightCm();
        int age = context.age();
        String sex = context.sex() != null ? context.sex().trim().toUpperCase() : "";

        return switch (sex) {
            case "ERKEK" -> 10 * weight + 6.25 * height - 5 * age + 5;
            case "KADIN" -> 10 * weight + 6.25 * height - 5 * age - 161;
            default -> 10 * weight + 6.25 * height - 5 * age - 78;
        };
    }

    private double resolveActivityMultiplier(String activityLevel) {
        if (activityLevel == null) {
            return 1.2;
        }

        return switch (activityLevel.trim().toUpperCase()) {
            case "DUSUK" -> 1.375;
            case "ORTA" -> 1.55;
            case "YUKSEK" -> 1.725;
            default -> 1.2;
        };
    }

    private double resolveGoalAdjustment(String goal) {
        if (goal == null) {
            return 0.0;
        }

        return switch (goal.trim().toUpperCase()) {
            case "KILO_VER" -> -400.0;
            case "KILO_AL" -> 300.0;
            case "KORU" -> 0.0;
            default -> 0.0;
        };
    }

    public record DailyCalorieSummary(
            Integer targetCalories,
            double consumedCalories,
            double burnedCalories,
            double netCalories,
            Double remainingCalories,
            Integer suggestedExtraSteps
    ) {
    }
}
