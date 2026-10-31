/** Locally bundled fallback: honest starter template, not claimed AI output. */
export const PYGAME_PLATFORMER = `import sys
import pygame

pygame.init()
WIDTH, HEIGHT = 960, 540
FPS = 60
GRAVITY = 0.65
SPEED = 5
JUMP = -13
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Kivo: Cyan Quest")
clock = pygame.time.Clock()
font = pygame.font.SysFont("consolas", 24)
small = pygame.font.SysFont("consolas", 17)

BG = (12, 22, 37)
CYAN = (65, 225, 231)
WHITE = (235, 247, 255)
GREY = (57, 82, 105)
GOLD = (255, 200, 77)
platforms = [
    pygame.Rect(0, 510, 960, 30),
    pygame.Rect(110, 418, 185, 20),
    pygame.Rect(355, 345, 170, 20),
    pygame.Rect(600, 272, 165, 20),
    pygame.Rect(780, 418, 135, 20),
]
start = (50, 460)
player = pygame.Rect(*start, 30, 40)
velocity_y = 0
on_ground = False
coins = [pygame.Rect(205, 385, 14, 14), pygame.Rect(435, 310, 14, 14),
         pygame.Rect(690, 238, 14, 14)]
collected = 0
exit_door = pygame.Rect(865, 462, 38, 48)
won = False
running = True

while running:
    dt = min(clock.tick(FPS) / 16.667, 2.0)
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                running = False
            if event.key in (pygame.K_SPACE, pygame.K_w, pygame.K_UP) and on_ground and not won:
                velocity_y = JUMP
                on_ground = False
            if event.key == pygame.K_r:
                player.topleft = start
                velocity_y = 0
                collected = 0
                won = False
                coins = [pygame.Rect(205, 385, 14, 14), pygame.Rect(435, 310, 14, 14),
                         pygame.Rect(690, 238, 14, 14)]

    if not won:
        keys = pygame.key.get_pressed()
        dx = (int(keys[pygame.K_d] or keys[pygame.K_RIGHT]) -
              int(keys[pygame.K_a] or keys[pygame.K_LEFT])) * SPEED * dt
        player.x += round(dx)
        player.left = max(0, player.left)
        player.right = min(WIDTH, player.right)
        for platform in platforms:
            if player.colliderect(platform):
                if dx > 0:
                    player.right = platform.left
                elif dx < 0:
                    player.left = platform.right

        velocity_y = min(velocity_y + GRAVITY * dt, 16)
        dy = round(velocity_y * dt)
        player.y += dy
        on_ground = False
        for platform in platforms:
            if player.colliderect(platform):
                if dy >= 0:
                    player.bottom = platform.top
                    velocity_y = 0
                    on_ground = True
                elif dy < 0:
                    player.top = platform.bottom
                    velocity_y = 0

        if player.y > HEIGHT + 50:
            player.topleft = start
            velocity_y = 0
        for coin in coins[:]:
            if player.colliderect(coin):
                coins.remove(coin)
                collected += 1
        if player.colliderect(exit_door) and not coins:
            won = True

    screen.fill(BG)
    for x in range(0, WIDTH, 48):
        pygame.draw.line(screen, (19, 34, 52), (x, 0), (x, HEIGHT))
    for platform in platforms:
        pygame.draw.rect(screen, GREY, platform, border_radius=4)
        pygame.draw.rect(screen, CYAN, (platform.x, platform.y, platform.width, 4))
    for coin in coins:
        pygame.draw.circle(screen, GOLD, coin.center, 9)
    pygame.draw.rect(screen, (55, 170, 110) if not coins else (98, 104, 124),
                     exit_door, border_radius=5)
    pygame.draw.rect(screen, CYAN, player, border_radius=6)
    pygame.draw.circle(screen, BG, (player.centerx - 6, player.y + 12), 3)
    pygame.draw.circle(screen, BG, (player.centerx + 6, player.y + 12), 3)
    screen.blit(font.render(f"CYAN QUEST  |  Coins: {collected}/3", True, WHITE), (24, 18))
    screen.blit(small.render("A/D or arrows: move  |  Space: jump  |  R: restart  |  Esc: quit", True, WHITE), (24, 53))
    if won:
        label = font.render("LEVEL COMPLETE!  Press R to restart", True, GOLD)
        screen.blit(label, label.get_rect(center=(WIDTH // 2, HEIGHT // 3)))
    pygame.display.flip()

pygame.quit()
sys.exit()
`;

export function bundledFallback(filename, task) {
  if (!/\.py$/i.test(filename)) return null;
  if (!/\b(?:pygame|platformer)\b/i.test(task) || !/\b(?:game|platformer)\b/i.test(task)) return null;
  // Don't replace a bespoke genre request with a different game.
  if (/\b(?:racing|chess|snake|shooter|puzzle|tetris|golf|3d|multiplayer|fps|pong|rhythm)\b/i.test(task)) return null;
  return {content:PYGAME_PLATFORMER,summary:'Bundled, syntax-checked 960×540 Pygame platformer starter (fallback; not AI-generated)'};
}
