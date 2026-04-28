package com.student.recipe.service.assistant;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.student.recipe.dto.assistant.UserAiProfileContextDto;

@Service
public class UserAiContextPromptBuilder {

    public String buildProfileParagraph(UserAiProfileContextDto context) {
        List<String> parts = new ArrayList<>();

        if (context.age() != null) {
            parts.add("The user is " + context.age() + " years old");
        } else {
            parts.add("The user's age is not specified");
        }

        if (hasText(context.sex())) {
            parts.add("sex is " + readableEnum(context.sex()));
        }
        if (context.heightCm() != null) {
            parts.add(formatNumber(context.heightCm()) + " cm tall");
        }
        if (context.weightKg() != null) {
            parts.add("weighs " + formatNumber(context.weightKg()) + " kg");
        }
        if (hasText(context.activityLevel())) {
            parts.add("activity level is " + readableEnum(context.activityLevel()));
        }
        if (hasText(context.goal())) {
            parts.add("goal is " + readableEnum(context.goal()));
        }
        if (hasText(context.dietType())) {
            parts.add("diet type is " + readableEnum(context.dietType()));
        }
        if (hasText(context.budgetLevel())) {
            parts.add("budget preference is " + readableEnum(context.budgetLevel()));
        }

        StringBuilder paragraph = new StringBuilder(String.join(", ", parts)).append(".");

        appendList(paragraph, "Chronic conditions", context.chronicConditions());
        appendList(paragraph, "Medications", context.medications());
        appendList(paragraph, "Allergies", context.allergies());
        appendList(paragraph, "Intolerances", context.intolerances());
        appendList(paragraph, "Foods to avoid", context.avoidFoods());
        appendList(paragraph, "Preferred foods", context.preferredFoods());

        return paragraph.toString().replaceAll("\\s+", " ").trim();
    }

    private void appendList(StringBuilder paragraph, String label, List<String> values) {
        if (values == null || values.isEmpty()) {
            return;
        }

        paragraph.append(' ')
                .append(label)
                .append(": ")
                .append(String.join(", ", values))
                .append('.');
    }

    private String readableEnum(String value) {
        return value == null ? "" : value.trim().replace('_', ' ').toLowerCase();
    }

    private String formatNumber(Double value) {
        if (value == null) {
            return "";
        }
        if (Math.floor(value) == value) {
            return String.valueOf(value.intValue());
        }
        return String.format(java.util.Locale.US, "%.1f", value);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
