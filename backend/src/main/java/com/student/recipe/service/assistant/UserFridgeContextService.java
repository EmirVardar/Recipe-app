package com.student.recipe.service.assistant;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.student.recipe.dto.fridge.FridgeItemResponseDto;
import com.student.recipe.service.UserFridgeService;

@Service
public class UserFridgeContextService {

    private final UserFridgeService userFridgeService;

    public UserFridgeContextService(UserFridgeService userFridgeService) {
        this.userFridgeService = userFridgeService;
    }

    @Transactional(readOnly = true)
    public List<FridgeItemResponseDto> getItems(String email) {
        return userFridgeService.getItems(email);
    }

    @Transactional(readOnly = true)
    public String buildFridgeContext(String email) {
        List<FridgeItemResponseDto> items = userFridgeService.getItems(email);
        if (items.isEmpty()) {
            return "=== FRIDGE ITEMS ===\n(No items in the fridge.)";
        }

        StringBuilder sb = new StringBuilder("=== FRIDGE ITEMS ===\n");
        for (FridgeItemResponseDto item : items) {
            sb.append("- ")
                    .append(item.foodName())
                    .append(": ")
                    .append(formatNumber(item.quantity()))
                    .append(' ')
                    .append("PIECE".equals(item.unitType()) ? "pieces" : "g")
                    .append(" (")
                    .append(formatNumber(item.calories()))
                    .append(" kcal")
                    .append(")\n");
        }

        return sb.toString().trim();
    }

    private String formatNumber(Double value) {
        if (value == null) {
            return "0";
        }
        if (Math.floor(value) == value) {
            return String.valueOf(value.intValue());
        }
        return String.format(java.util.Locale.US, "%.1f", value);
    }
}
