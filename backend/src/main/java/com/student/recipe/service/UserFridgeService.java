package com.student.recipe.service;

import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.fridge.FridgeItemCreateRequestDto;
import com.student.recipe.dto.fridge.FridgeItemResponseDto;
import com.student.recipe.entity.FoodProduct;
import com.student.recipe.entity.User;
import com.student.recipe.entity.UserFridgeItem;
import com.student.recipe.entity.enums.MealUnitType;
import com.student.recipe.repository.FoodProductRepository;
import com.student.recipe.repository.UserFridgeItemRepository;
import com.student.recipe.repository.UserRepository;

@Service
public class UserFridgeService {

    private final UserRepository userRepository;
    private final FoodProductRepository foodProductRepository;
    private final UserFridgeItemRepository userFridgeItemRepository;

    public UserFridgeService(
            UserRepository userRepository,
            FoodProductRepository foodProductRepository,
            UserFridgeItemRepository userFridgeItemRepository
    ) {
        this.userRepository = userRepository;
        this.foodProductRepository = foodProductRepository;
        this.userFridgeItemRepository = userFridgeItemRepository;
    }

    @Transactional(readOnly = true)
    public List<FridgeItemResponseDto> getItems(String email) {
        User user = getUserByEmail(email);
        return userFridgeItemRepository.findAllByUserIdOrderByUpdatedAtDesc(user.getId())
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public FridgeItemResponseDto addItem(String email, FridgeItemCreateRequestDto request) {
        validateRequest(request);

        User user = getUserByEmail(email);
        FoodProduct foodProduct = getFoodProduct(request.foodProductId());
        MealUnitType unitType = parseUnitType(request.unitType());

        UserFridgeItem item = new UserFridgeItem();
        item.setUser(user);
        applyFoodData(item, foodProduct, request.quantity(), unitType);

        return toDto(userFridgeItemRepository.save(item));
    }

    @Transactional
    public FridgeItemResponseDto updateItem(String email, Long itemId, FridgeItemCreateRequestDto request) {
        validateRequest(request);

        User user = getUserByEmail(email);
        UserFridgeItem item = getOwnedItem(user.getId(), itemId);
        FoodProduct foodProduct = getFoodProduct(request.foodProductId());
        MealUnitType unitType = parseUnitType(request.unitType());

        applyFoodData(item, foodProduct, request.quantity(), unitType);
        return toDto(userFridgeItemRepository.save(item));
    }

    @Transactional
    public void deleteItem(String email, Long itemId) {
        User user = getUserByEmail(email);
        UserFridgeItem item = getOwnedItem(user.getId(), itemId);
        userFridgeItemRepository.delete(item);
    }

    private void applyFoodData(UserFridgeItem item, FoodProduct foodProduct, double quantity, MealUnitType unitType) {
        double gramEquivalent = calculateGramEquivalent(foodProduct, quantity, unitType);
        item.setFoodProduct(foodProduct);
        item.setQuantity(quantity);
        item.setUnitType(unitType);
        item.setGramEquivalent(gramEquivalent);
    }

    private double calculateGramEquivalent(FoodProduct foodProduct, double quantity, MealUnitType unitType) {
        if (unitType == MealUnitType.GRAM) {
            return quantity;
        }

        double basePieceWeight = foodProduct.getPieceGramWeight() != null
                ? foodProduct.getPieceGramWeight()
                : foodProduct.getDefaultGramWeight();

        if (basePieceWeight <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bu urun icin adet gram bilgisi yok");
        }

        return quantity * basePieceWeight;
    }

    private FridgeItemResponseDto toDto(UserFridgeItem item) {
        FoodProduct foodProduct = item.getFoodProduct();
        double factor = item.getGramEquivalent() / 100.0;

        return new FridgeItemResponseDto(
                item.getId(),
                foodProduct.getId(),
                resolveFoodName(foodProduct),
                item.getQuantity(),
                item.getUnitType().name(),
                item.getGramEquivalent(),
                scaleMacro(foodProduct.getCaloriesPer100g(), factor),
                scaleMacro(foodProduct.getProteinPer100g(), factor),
                scaleMacro(foodProduct.getCarbsPer100g(), factor),
                scaleMacro(foodProduct.getFatPer100g(), factor),
                foodProduct.getDefaultGramWeight(),
                foodProduct.getPieceGramWeight()
        );
    }

    private double scaleMacro(Double per100gValue, double factor) {
        if (per100gValue == null) {
            return 0.0;
        }
        return per100gValue * factor;
    }

    private UserFridgeItem getOwnedItem(Long userId, Long itemId) {
        UserFridgeItem item = userFridgeItemRepository.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fridge item not found"));

        if (!item.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu buzdolabi ogesi baska bir kullaniciya ait");
        }

        return item;
    }

    private FoodProduct getFoodProduct(Long id) {
        return foodProductRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food product not found"));
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private MealUnitType parseUnitType(String raw) {
        try {
            return MealUnitType.valueOf(normalizeEnumToken(raw));
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unitType gecersiz");
        }
    }

    private String normalizeEnumToken(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Zorunlu alan bos");
        }

        return raw.trim()
                .replace('-', '_')
                .replace(' ', '_')
                .toUpperCase(Locale.ROOT);
    }

    private String resolveFoodName(FoodProduct foodProduct) {
        if (foodProduct.getNameTr() != null && !foodProduct.getNameTr().isBlank()) {
            return foodProduct.getNameTr();
        }
        return foodProduct.getName();
    }

    private void validateRequest(FridgeItemCreateRequestDto request) {
        if (request.foodProductId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "foodProductId zorunlu");
        }
        if (request.quantity() == null || request.quantity() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "quantity 0'dan buyuk olmali");
        }
        if (request.unitType() == null || request.unitType().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unitType zorunlu");
        }
    }
}
