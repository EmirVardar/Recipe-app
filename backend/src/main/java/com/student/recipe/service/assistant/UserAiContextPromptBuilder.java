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
            parts.add("Kullanıcı " + context.age() + " yaşında");
        } else {
            parts.add("Kullanıcının yaşı belirtilmemiş");
        }

        if (hasText(context.sex())) {
            parts.add("cinsiyet: " + readableEnum(context.sex()));
        }
        if (context.heightCm() != null) {
            parts.add("boy: " + formatNumber(context.heightCm()) + " cm");
        }
        if (context.weightKg() != null) {
            parts.add("kilo: " + formatNumber(context.weightKg()) + " kg");
        }
        if (hasText(context.activityLevel())) {
            parts.add("aktivite seviyesi: " + readableEnum(context.activityLevel()));
        }
        if (hasText(context.goal())) {
            parts.add("hedef: " + readableEnum(context.goal()));
        }
        if (hasText(context.dietType())) {
            parts.add("diyet tipi: " + readableEnum(context.dietType()));
        }
        if (hasText(context.budgetLevel())) {
            parts.add("bütçe tercihi: " + readableEnum(context.budgetLevel()));
        }

        StringBuilder paragraph = new StringBuilder(String.join(", ", parts)).append(".");

        appendList(paragraph, "Kronik hastalıklar", context.chronicConditions());
        appendList(paragraph, "İlaçlar", context.medications());
        appendList(paragraph, "Alerjiler", context.allergies());
        appendList(paragraph, "İntoleranslar", context.intolerances());
        appendList(paragraph, "Kaçınılan yiyecekler", context.avoidFoods());
        appendList(paragraph, "Tercih edilen yiyecekler", context.preferredFoods());

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