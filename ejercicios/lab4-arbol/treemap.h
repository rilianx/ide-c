#ifndef TREEMAP_h
#define TREEMAP_h

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct Pair Pair;
typedef struct TreeNode TreeNode;
typedef struct TreeMap TreeMap;

// Un par (clave, valor). La clave es void *: puede apuntar a cualquier tipo (en los tests, un int).
struct Pair {
    void * key;
    void * value;
};

// Un nodo del árbol binario de búsqueda.
struct TreeNode {
    Pair * pair;        // el par (key, value) del nodo
    TreeNode * left;    // hijo izquierdo (claves menores)
    TreeNode * right;   // hijo derecho (claves mayores)
    TreeNode * parent;  // el padre (NULL en la raíz)
};

// El mapa ordenado: la raíz, el nodo actual (para recorrer) y la función que compara claves.
struct TreeMap {
    TreeNode * root;
    TreeNode * current;
    int (*lower_than) (void * key1, void * key2);   // 1 si key1 < key2, 0 si no
};

// Retorna 1 si las claves son iguales (ninguna es menor que la otra) y 0 si no.
int is_equal(TreeMap * tree, void * key1, void * key2) {
    if (tree->lower_than(key1, key2) == 0 && tree->lower_than(key2, key1) == 0) return 1;
    else return 0;
}

// Crea un nodo con el par (key, value); left, right y parent en NULL.
TreeNode * createTreeNode(void * key, void * value) {
    TreeNode * new = (TreeNode *)malloc(sizeof(TreeNode));
    if (new == NULL) return NULL;
    new->pair = (Pair *)malloc(sizeof(Pair));
    new->pair->key = key;
    new->pair->value = value;
    new->parent = new->left = new->right = NULL;
    return new;
}

TreeMap * createTreeMap(int (*lower_than) (void * key1, void * key2));

Pair * searchTreeMap(TreeMap * tree, void * key);

void insertTreeMap(TreeMap * tree, void * key, void * value);

TreeNode * minimum(TreeNode * x);

void removeNode(TreeMap * tree, TreeNode * node);

// Elimina el dato con la clave key (usa searchTreeMap y removeNode).
void eraseTreeMap(TreeMap * tree, void * key) {
    if (tree == NULL || tree->root == NULL) return;
    if (searchTreeMap(tree, key) == NULL) return;
    TreeNode * node = tree->current;
    removeNode(tree, node);
}

Pair * firstTreeMap(TreeMap * tree);

Pair * nextTreeMap(TreeMap * tree);

Pair * upperBound(TreeMap * tree, void * key);

#endif /* TREEMAP_h */
