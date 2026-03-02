package com.student.recipe.service;

import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.AuthResponseDto;
import com.student.recipe.dto.LoginRequestDto;
import com.student.recipe.dto.RegisterRequestDto;
import com.student.recipe.entity.User;
import com.student.recipe.repository.UserRepository;
import com.student.recipe.security.JwtService;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CustomUserDetailsService userDetailsService;
    private final JwtService jwtService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            CustomUserDetailsService userDetailsService,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userDetailsService = userDetailsService;
        this.jwtService = jwtService;
    }

    public AuthResponseDto register(RegisterRequestDto request) {
        String email = normalizeEmail(request.email());
        validateRegisterRequest(request, email);

        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password().trim()));
        user.setFullName(request.fullName().trim());

        User savedUser = userRepository.save(user);
        String token = jwtService.generateToken(userDetailsService.loadUserByUsername(savedUser.getEmail()));

        return new AuthResponseDto(
                savedUser.getId(),
                savedUser.getEmail(),
                savedUser.getFullName(),
                token,
                "Registration successful");
    }

    public AuthResponseDto login(LoginRequestDto request) {
        String email = normalizeEmail(request.email());

        if (email.isBlank() || isBlank(request.password())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        String token = jwtService.generateToken(userDetailsService.loadUserByUsername(user.getEmail()));

        return new AuthResponseDto(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                token,
                "Login successful");
    }

    private void validateRegisterRequest(RegisterRequestDto request, String email) {
        if (email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }

        if (isBlank(request.password()) || request.password().trim().length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters");
        }

        if (isBlank(request.fullName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Full name is required");
        }

    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
