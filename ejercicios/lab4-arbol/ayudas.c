// ayudas.c: funciones auxiliares que usan los tests.
// NO se deben cambiar (este archivo es de solo lectura).
//
// Cada test arma un árbol de entrada (arbolCon), llama a tu función y muestra lo que
// retorna (retorno) y cómo quedó el árbol (resultado). Estas funciones trabajan directo
// sobre los structs de treemap.h, sin llamar a tus funciones.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <unistd.h>
#include "treemap.h"

// ¿El puntero apunta a memoria reservada? (para no caerse con punteros basura)
static int valido(void * p) {
    uintptr_t a = (uintptr_t)p;
    return p != NULL && a % sizeof(int) == 0 && a > 4096 && a < (uintptr_t)sbrk(0);
}

// La función que compara claves int: 1 si key1 < key2.
int lower_than_int(void * key1, void * key2) {
    int k1 = *((int *)(key1));
    int k2 = *((int *)(key2));
    return k1 < k2;
}

// Un entero en memoria dinámica, para usarlo como clave.
int * entero(int v) {
    int * p = (int *)malloc(sizeof(int));
    *p = v;
    return p;
}

// Un texto en memoria dinámica, para usarlo como valor.
char * texto(const char * s) {
    char * p = (char *)malloc(strlen(s) + 1);
    strcpy(p, s);
    return p;
}

// Arma un árbol insertando las n claves en ese orden (sin usar tus funciones; las palabras son los valores).
// Deja current en NULL.
TreeMap * arbolCon(int n, const int * claves, char ** palabras) {
    TreeMap * tree = (TreeMap *)malloc(sizeof(TreeMap));
    tree->root = tree->current = NULL;
    tree->lower_than = lower_than_int;
    for (int i = 0; i < n; i++) {
        TreeNode * nuevo = createTreeNode(entero(claves[i]), texto(palabras[i]));
        TreeNode * p = NULL, * x = tree->root;
        while (x != NULL) { p = x; x = claves[i] < *(int *)x->pair->key ? x->left : x->right; }
        nuevo->parent = p;
        if (p == NULL) tree->root = nuevo;
        else if (claves[i] < *(int *)p->pair->key) p->left = nuevo;
        else p->right = nuevo;
    }
    return tree;
}

// El nodo con esa clave (para dejar current ahí o pasarlo a una función).
TreeNode * nodoCon(TreeMap * tree, int clave) {
    TreeNode * x = tree->root;
    while (x != NULL && *(int *)x->pair->key != clave) x = clave < *(int *)x->pair->key ? x->left : x->right;
    return x;
}

// Llena la memoria libre con basura (para notar campos que no se inicializan).
void ensuciarMemoria(void) {
    void * p[8];
    for (int i = 0; i < 8; i++) { p[i] = malloc(sizeof(TreeMap)); memset(p[i], 0x5A, sizeof(TreeMap)); }
    for (int i = 7; i >= 0; i--) free(p[i]);
}

static void clave(void * k) {
    if (k == NULL) printf("NULL");
    else if (!valido(k)) printf("basura");
    else printf("%d", *(int *)k);
}

// Lo que retornó una función que retorna un Pair *: su clave (o NULL).
void retorno(Pair * p) {
    printf("retorna: ");
    if (p == NULL) printf("NULL");
    else if (!valido(p)) printf("basura");
    else clave(p->key);
    printf("\n");
}

// Lo que retornó una función que retorna un TreeNode *: la clave del nodo (o NULL).
void retornoNodo(TreeNode * n) {
    printf("retorna: ");
    if (n == NULL) printf("NULL");
    else if (!valido(n) || !valido(n->pair)) printf("basura");
    else clave(n->pair->key);
    printf("\n");
}

// El subárbol en preorden: «5239(1273, 8213(6980, -))» (- es un hijo NULL; una hoja va sola).
static int malos;
static void sub(TreeNode * n, int prof) {
    if (n == NULL) { printf("-"); return; }
    if (!valido(n) || !valido(n->pair) || prof > 30) { printf("basura"); malos++; return; }
    clave(n->pair->key);
    if (n->left == NULL && n->right == NULL) return;
    printf("(");
    sub(n->left, prof + 1);
    printf(", ");
    sub(n->right, prof + 1);
    printf(")");
}

// El primer nodo cuyo parent no apunta a su padre de verdad (o NULL si todos bien).
static TreeNode * padreMalo(TreeNode * n, TreeNode * padre, int prof) {
    if (n == NULL || !valido(n) || prof > 30) return NULL;
    if (n->parent != padre) return n;
    TreeNode * m = padreMalo(n->left, n, prof + 1);
    return m != NULL ? m : padreMalo(n->right, n, prof + 1);
}

// Cómo quedó el árbol:
//   arbol: 5239(1273, 8213(6980, -))
//   padres: bien                    (o el primer nodo con el parent equivocado)
//   lower_than: bien
//   current: 6980                   (solo si conCurrent)
void resultado(TreeMap * tree, int conCurrent) {
    if (tree == NULL) { printf("arbol: NULL\n"); return; }
    if (!valido(tree)) { printf("arbol: basura\n"); return; }
    malos = 0;
    printf("arbol: ");
    if (tree->root == NULL) printf("(vacío)");
    else sub(tree->root, 0);
    printf("\n");
    TreeNode * m = malos ? NULL : padreMalo(tree->root, NULL, 0);
    if (m == NULL) printf("padres: bien\n");
    else { printf("padres: el parent de "); clave(m->pair->key); printf(" no apunta a su padre\n"); }
    printf("lower_than: %s\n", tree->lower_than == lower_than_int ? "bien" : "no es la función dada");
    if (conCurrent) {
        printf("current: ");
        if (tree->current == NULL) printf("NULL");
        else if (!valido(tree->current) || !valido(tree->current->pair)) printf("basura");
        else clave(tree->current->pair->key);
        printf("\n");
    }
}
